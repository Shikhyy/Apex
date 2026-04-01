"""Strategist agent — trade intent generation."""

from langchain_groq import ChatGroq
from agents.graph import APEXState, TradeIntent
from dotenv import load_dotenv
import os

load_dotenv()

llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0.1,
    api_key=os.environ.get("GROQ_API_KEY", ""),
    max_retries=3,
)

STRATEGIST_SYSTEM = """You are the STRATEGIST agent in the APEX yield optimizer.
Rank opportunities by risk-adjusted return and generate signed trade intents.

Rules:
- Maximum single position: 20% of vault balance
- Scale down position by (volatility_index / 100)
- Never enter position if expected_pnl < $0 after estimated gas cost
- Confidence < 0.5 → exclude from ranked list
"""


def strategist_node(state: APEXState) -> dict:
    """Strategist node — ranks opportunities and generates trade intents."""
    # TODO: Implement ranking + EIP-712 signing
    return {
        "ranked_intents": [],
        "strategist_reasoning": "Strategist node stub — real intent generation pending.",
    }
