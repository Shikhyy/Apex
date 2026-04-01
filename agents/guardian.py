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


def guardian_node(state: APEXState) -> dict:
    """Guardian node — evaluates trade intents and issues veto or approval."""
    # TODO: Implement full veto logic with deterministic pre-checks
    # For now, default to APPROVED for stub
    return {
        "guardian_decision": "PENDING",
        "guardian_reason": "no_opportunities",
        "guardian_detail": "Guardian node stub — no intents to evaluate.",
        "guardian_confidence": 1.0,
    }
