"""Guardian agent — risk management and circuit breaker."""

import json
from langchain_groq import ChatGroq
from agents.graph import APEXState, GuardianReason
from dotenv import load_dotenv
import os

load_dotenv()

llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0.0,
    api_key=os.environ.get("GROQ_API_KEY", ""),
    max_retries=3,
)

VETO_THRESHOLDS = {
    "max_drawdown_pct": 5.0,
    "max_volatility_idx": 65.0,
    "min_scout_rep": 0.60,
    "max_apy_suspicious": 50.0,
    "min_liquidity_usd": 500_000,
    "min_sentiment": -0.5,
}

GUARDIAN_SYSTEM = """You are the GUARDIAN agent in the APEX yield optimizer.

Your ONLY job is to protect capital. You earn on-chain ERC-8004 reputation
by REFUSING bad trades — not by approving good ones. A correct veto increases
your reputation score. An incorrect approval that causes loss decreases it.

VETO IMMEDIATELY if ANY single condition is true:
1. Volatility index > {max_volatility}
2. Projected drawdown > {max_drawdown}%
3. Scout agent reputation score < {min_scout_rep}
4. APY > {max_apy}% (exploit/rug risk)
5. Pool liquidity < ${min_liquidity:,}
6. Sentiment score < {min_sentiment}
7. YOU ARE UNCERTAIN — when in doubt, VETO

You MUST respond with ONLY valid JSON:
{{
  "decision": "APPROVED" | "VETOED",
  "reason": "<reason_code>",
  "detail": "<one sentence explanation>",
  "confidence": <0.0-1.0>
}}
"""


def _veto(
    decision: str, reason: GuardianReason, detail: str, confidence: float = 1.0
) -> dict:
    """Build a guardian decision dict."""
    return {
        "guardian_decision": decision,
        "guardian_reason": reason,
        "guardian_detail": detail,
        "guardian_confidence": confidence,
    }


def guardian_node(state: APEXState) -> dict:
    """Guardian node — evaluates trade intents and issues veto or approval.

    Runs deterministic pre-checks first (fast, reliable, bypass LLM),
    then falls through to LLM evaluation if all pre-checks pass.
    Any error defaults to VETO for safety.
    """
    try:
        # ── 1. Deterministic pre-checks ──────────────────────────────────
        ranked_intents = state.get("ranked_intents", [])
        if not ranked_intents:
            print("[Guardian] VETO: no opportunities to evaluate")
            return _veto(
                "VETOED",
                "no_opportunities",
                "No ranked trade intents found to evaluate.",
            )

        volatility_index = state.get("volatility_index", 0.0)
        sentiment_score = state.get("sentiment_score", 0.0)

        # Volatility spike
        if volatility_index > VETO_THRESHOLDS["max_volatility_idx"]:
            print(
                f"[Guardian] VETO: volatility_index={volatility_index} > {VETO_THRESHOLDS['max_volatility_idx']}"
            )
            return _veto(
                "VETOED",
                "volatility_spike",
                f"Volatility index {volatility_index:.1f} exceeds threshold {VETO_THRESHOLDS['max_volatility_idx']:.1f}.",
            )

        # Suspicious APY — check every opportunity in ranked intents
        for intent in ranked_intents:
            opp = intent.get("opportunity", {})
            apy = opp.get("apy", 0.0)
            if apy > VETO_THRESHOLDS["max_apy_suspicious"]:
                print(
                    f"[Guardian] VETO: APY={apy}% > {VETO_THRESHOLDS['max_apy_suspicious']}% for {opp.get('protocol', 'unknown')}"
                )
                return _veto(
                    "VETOED",
                    "suspicious_apy",
                    f"APY {apy:.1f}% for {opp.get('protocol', 'unknown')} exceeds suspicious threshold {VETO_THRESHOLDS['max_apy_suspicious']}%.",
                )

        # Low liquidity — check every opportunity
        for intent in ranked_intents:
            opp = intent.get("opportunity", {})
            liquidity = opp.get("liquidity_usd", 0.0)
            if liquidity < VETO_THRESHOLDS["min_liquidity_usd"]:
                print(
                    f"[Guardian] VETO: liquidity=${liquidity:,.0f} < ${VETO_THRESHOLDS['min_liquidity_usd']:,.0f} for {opp.get('protocol', 'unknown')}"
                )
                return _veto(
                    "VETOED",
                    "low_liquidity",
                    f"Liquidity ${liquidity:,.0f} for {opp.get('protocol', 'unknown')} below minimum ${VETO_THRESHOLDS['min_liquidity_usd']:,.0f}.",
                )

        # Negative sentiment
        if sentiment_score < VETO_THRESHOLDS["min_sentiment"]:
            print(
                f"[Guardian] VETO: sentiment={sentiment_score} < {VETO_THRESHOLDS['min_sentiment']}"
            )
            return _veto(
                "VETOED",
                "negative_sentiment",
                f"Sentiment score {sentiment_score:.2f} below threshold {VETO_THRESHOLDS['min_sentiment']:.2f}.",
            )

        # ── 2. LLM evaluation ────────────────────────────────────────────
        intents_summary = "\n".join(
            f"- {i.get('opportunity', {}).get('protocol', '?')}/{i.get('opportunity', {}).get('pool', '?')}: "
            f"APY={i.get('opportunity', {}).get('apy', 0):.1f}%, "
            f"TVL=${i.get('opportunity', {}).get('tvl_usd', 0):,.0f}, "
            f"Liquidity=${i.get('opportunity', {}).get('liquidity_usd', 0):,.0f}, "
            f"Amount=${i.get('amount_usd', 0):,.0f}, "
            f"Confidence={i.get('confidence', 0):.2f}"
            for i in ranked_intents
        )

        user_prompt = (
            f"Market context:\n"
            f"  Volatility index: {volatility_index:.1f}\n"
            f"  Sentiment score:  {sentiment_score:.2f}\n\n"
            f"Ranked trade intents:\n{intents_summary}\n\n"
            f"Scout reasoning: {state.get('scout_reasoning', 'N/A')}\n"
            f"Strategist reasoning: {state.get('strategist_reasoning', 'N/A')}\n\n"
            f"Evaluate these intents and respond with JSON only."
        )

        system_prompt = GUARDIAN_SYSTEM.format(
            max_volatility=VETO_THRESHOLDS["max_volatility_idx"],
            max_drawdown=VETO_THRESHOLDS["max_drawdown_pct"],
            min_scout_rep=VETO_THRESHOLDS["min_scout_rep"],
            max_apy=VETO_THRESHOLDS["max_apy_suspicious"],
            min_liquidity=VETO_THRESHOLDS["min_liquidity_usd"],
            min_sentiment=VETO_THRESHOLDS["min_sentiment"],
        )

        print("[Guardian] Sending to LLM for evaluation...")
        response = llm.invoke([("system", system_prompt), ("human", user_prompt)])
        content = response.content.strip()

        # Strip markdown code fences if present
        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

        parsed = json.loads(content)
        decision = parsed.get("decision", "VETOED").upper()
        reason = parsed.get("reason", "uncertainty")
        detail = parsed.get("detail", "LLM evaluation returned incomplete response.")
        confidence = float(parsed.get("confidence", 0.5))

        # Validate decision value
        if decision not in ("APPROVED", "VETOED"):
            print(
                f"[Guardian] LLM returned invalid decision '{decision}', defaulting to VETO"
            )
            return _veto(
                "VETOED", "uncertainty", "LLM returned an unrecognizable decision.", 0.0
            )

        # Validate reason is a known GuardianReason
        valid_reasons = {
            "volatility_spike",
            "drawdown_limit",
            "low_scout_reputation",
            "suspicious_apy",
            "low_liquidity",
            "negative_sentiment",
            "uncertainty",
            "safe_to_proceed",
            "no_opportunities",
        }
        if reason not in valid_reasons:
            reason = "uncertainty"

        if decision == "APPROVED":
            reason = "safe_to_proceed"

        print(f"[Guardian] LLM decision: {decision} ({reason}) — {detail}")
        return _veto(decision, reason, detail, confidence)

    except Exception as e:
        # ── 3. Fallback: any error → VETO ────────────────────────────────
        print(f"[Guardian] ERROR: {e} — defaulting to VETO")
        return _veto(
            "VETOED", "uncertainty", f"Guardian evaluation failed: {str(e)}", 0.0
        )
