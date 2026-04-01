"""Scout agent — market intelligence."""

from langchain_groq import ChatGroq
from agents.graph import APEXState, YieldOpportunity
from dotenv import load_dotenv
import os

load_dotenv()

llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0.1,
    api_key=os.environ.get("GROQ_API_KEY", ""),
    max_retries=3,
)

SCOUT_SYSTEM = """You are the SCOUT agent in the APEX yield optimizer.
Fetch real-time yield data using all available tools, then synthesize
into a structured JSON opportunity list.

Rules:
- Flag APY > 50% as suspicious (risk_score = 0.95)
- Exclude pools with < $500,000 liquidity
- Normalize risk score based on protocol maturity, audit status, and TVL
- Output ONLY valid JSON, no prose
"""


def scout_node(state: APEXState) -> dict:
    """Scout node — fetches market data and synthesizes opportunities."""
    # TODO: Implement agentic tool-calling loop with MCP tools
    # For now, return stub data so the graph can run
    return {
        "opportunities": [
            YieldOpportunity(
                protocol="aave",
                pool="USDC-v3",
                apy=4.23,
                tvl_usd=2_400_000_000,
                risk_score=0.15,
                liquidity_usd=1_800_000_000,
            )
        ],
        "volatility_index": 42.3,
        "sentiment_score": 0.24,
        "scout_reasoning": "Scout node stub — real market data integration pending.",
    }
