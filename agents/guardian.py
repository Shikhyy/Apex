"""Guardian agent — risk management and circuit breaker."""

import json
import asyncio
import logging
from typing import Optional
from langchain_groq import ChatGroq
from agents.graph import APEXState, GuardianReason
from mcp_tools.risk_analysis import calculate_projected_drawdown, fetch_agent_reputation
from dotenv import load_dotenv
import os

load_dotenv()

logger = logging.getLogger(__name__)

load_dotenv()

_llm: Optional[ChatGroq] = None


def _get_llm() -> Optional[ChatGroq]:
    """Lazy LLM initialization — returns None if no API key."""
    global _llm
    if _llm is not None:
        return _llm
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        return None
    _llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0.0,
        api_key=api_key,
        max_retries=3,
    )
    return _llm


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

        # Projected drawdown — use MCP tool
        top_intent = ranked_intents[0]
        top_opp = top_intent.get("opportunity", {})
        projected_dd = calculate_projected_drawdown(top_opp, volatility_index)
        if projected_dd > VETO_THRESHOLDS["max_drawdown_pct"]:
            print(
                f"[Guardian] VETO: projected_drawdown={projected_dd}% > {VETO_THRESHOLDS['max_drawdown_pct']}%"
            )
            return _veto(
                "VETOED",
                "drawdown_limit",
                f"Projected drawdown {projected_dd:.2f}% exceeds threshold {VETO_THRESHOLDS['max_drawdown_pct']}%.",
            )

        # Scout reputation — check on-chain via ERC-8004
        scout_id = state.get("scout_agent_id", 0)
        if scout_id > 0:
            rep = fetch_agent_reputation(scout_id)
            if rep["normalized"] < VETO_THRESHOLDS["min_scout_rep"]:
                print(
                    f"[Guardian] VETO: scout_rep={rep['normalized']:.2f} < {VETO_THRESHOLDS['min_scout_rep']}"
                )
                return _veto(
                    "VETOED",
                    "low_scout_reputation",
                    f"Scout agent {scout_id} reputation {rep['normalized']:.2f} below threshold {VETO_THRESHOLDS['min_scout_rep']}.",
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
        llm = _get_llm()
        if llm is None:
            print("[Guardian] No Groq API key — defaulting to VETO")
            return _veto(
                "VETOED",
                "uncertainty",
                "Groq API key not configured. Cannot perform LLM evaluation.",
                0.0,
            )
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

        # LLM confidence threshold — if LLM itself is unsure, VETO
        if confidence < 0.5:
            print(f"[Guardian] VETO: LLM confidence={confidence:.2f} < 0.50")
            return _veto(
                "VETOED",
                "uncertainty",
                f"LLM confidence {confidence:.2f} below safety threshold 0.50.",
                confidence,
            )

        if decision == "APPROVED":
            reason = "safe_to_proceed"

        print(f"[Guardian] LLM decision: {decision} ({reason}) — {detail}")
        result = _veto(decision, reason, detail, confidence)

        # Post reputation signal to ERC-8004 after every decision
        _post_guardian_signal(state, decision, reason, detail, confidence)

        return result

    except Exception as e:
        # ── 3. Fallback: any error → VETO ────────────────────────────────
        logger.error("Guardian ERROR: %s — defaulting to VETO", e)
        result = _veto(
            "VETOED", "uncertainty", f"Guardian evaluation failed: {str(e)}", 0.0
        )
        _post_guardian_signal(state, "VETOED", "uncertainty", str(e), 0.0)
        return result


def _post_guardian_signal(
    state: APEXState,
    decision: str,
    reason: str,
    detail: str,
    confidence: float,
) -> None:
    """Post reputation signal to ERC-8004 after a Guardian decision (fire-and-forget)."""
    guardian_id = state.get("guardian_agent_id", 0)
    scout_id = state.get("scout_agent_id", 0)
    if guardian_id == 0 or scout_id == 0:
        logger.info("Agent IDs not registered — skipping reputation post")
        return

    evidence = {
        "decision": decision,
        "reason": reason,
        "detail": detail,
        "confidence": confidence,
        "volatility_index": state.get("volatility_index", 0),
        "sentiment_score": state.get("sentiment_score", 0),
        "opportunities_count": len(state.get("opportunities", [])),
        "intents_count": len(state.get("ranked_intents", [])),
    }

    async def _post():
        try:
            from mcp_tools.erc8004_skills import post_reputation_signal

            tx = await post_reputation_signal(
                reviewer_agent_id=guardian_id,
                subject_agent_id=scout_id,
                decision=decision,
                reason=reason,
                detail=detail,
                confidence=confidence,
                evidence=evidence,
            )
            logger.info(
                "Reputation signal posted: tx=%s score=%s",
                tx.get("tx_hash", "")[:20],
                tx.get("score"),
            )
        except Exception as e:
            logger.warning("Failed to post reputation signal: %s", e)

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_post())
    except RuntimeError:
        asyncio.run(_post())
