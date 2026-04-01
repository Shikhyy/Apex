"""Scout agent — market intelligence."""

import asyncio
import json
import logging
from typing import Any

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

from agents.graph import APEXState, YieldOpportunity
from mcp_tools.market_data import (
    fetch_aave_yields,
    fetch_curve_pools,
    fetch_volatility_index,
    fetch_sentiment,
)
from dotenv import load_dotenv
import os

load_dotenv()

logger = logging.getLogger(__name__)

_llm = None


def _get_llm():
    global _llm
    if _llm is None:
        _llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0.1,
            api_key=os.environ.get("GROQ_API_KEY", ""),
            max_retries=3,
        )
    return _llm


SCOUT_SYSTEM = """You are the SCOUT agent in the APEX yield optimizer.
Fetch real-time yield data using all available tools, then synthesize
into a structured JSON opportunity list.

Rules:
- Flag APY > 50% as suspicious (risk_score = 0.95)
- Exclude pools with < $500,000 liquidity
- Normalize risk score based on protocol maturity, audit status, and TVL
- Output ONLY valid JSON, no prose
"""


def _opportunity_to_dict(op: YieldOpportunity) -> dict[str, Any]:
    """Convert a YieldOpportunity TypedDict to a plain dict for JSON serialization."""
    return {
        "protocol": op["protocol"],
        "pool": op["pool"],
        "apy": op["apy"],
        "tvl_usd": op["tvl_usd"],
        "risk_score": op["risk_score"],
        "liquidity_usd": op["liquidity_usd"],
    }


def _parse_llm_response(
    text: str, raw_opps: list[YieldOpportunity]
) -> list[YieldOpportunity]:
    """Parse LLM JSON response into YieldOpportunity list with fallback."""
    try:
        # Try to extract JSON from the response (handle potential markdown code blocks)
        cleaned = text.strip()
        if cleaned.startswith("```"):
            # Strip markdown code fences
            lines = cleaned.split("\n")
            json_lines = [l for l in lines if not l.startswith("```")]
            cleaned = "\n".join(json_lines)

        parsed = json.loads(cleaned)

        # Handle both list and dict-with-opportunities formats
        if isinstance(parsed, dict):
            opp_list = parsed.get("opportunities", [])
        elif isinstance(parsed, list):
            opp_list = parsed
        else:
            raise ValueError("Unexpected JSON structure")

        opportunities: list[YieldOpportunity] = []
        for item in opp_list:
            apy = float(item.get("apy", 0))
            liquidity = float(item.get("liquidity_usd", 0))

            # Exclude low-liquidity pools
            if liquidity < 500_000:
                continue

            # Flag suspicious APY
            risk = float(item.get("risk_score", 0.5))
            if apy > 50:
                risk = 0.95

            opportunities.append(
                YieldOpportunity(
                    protocol=str(item.get("protocol", "unknown")),
                    pool=str(item.get("pool", "unknown")),
                    apy=round(apy, 2),
                    tvl_usd=float(item.get("tvl_usd", 0)),
                    risk_score=round(risk, 2),
                    liquidity_usd=round(liquidity, 2),
                )
            )

        if opportunities:
            return opportunities

    except (json.JSONDecodeError, ValueError, KeyError) as e:
        logger.warning("LLM response parsing failed (%s), using raw data", e)

    # Fallback: return raw opportunities from tools with basic filtering
    filtered: list[YieldOpportunity] = []
    for opp in raw_opps:
        if opp["liquidity_usd"] < 500_000:
            continue
        if opp["apy"] > 50:
            opp["risk_score"] = 0.95
        filtered.append(opp)
    return filtered if filtered else raw_opps


def _fetch_all_market_data() -> tuple[list[YieldOpportunity], float, float]:
    """Fetch all market data sources concurrently."""

    async def _gather():
        aave_pools, curve_pools, vol, sentiment = await asyncio.gather(
            fetch_aave_yields(),
            fetch_curve_pools(),
            fetch_volatility_index(),
            fetch_sentiment(),
        )
        return aave_pools, curve_pools, vol, sentiment

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import concurrent.futures

        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(asyncio.run, _gather())
            return future.result()
    return asyncio.run(_gather())


def scout_node(state: APEXState) -> dict:
    """Scout node — fetches market data and synthesizes opportunities."""
    try:
        # 1. Fetch raw market data from all sources
        aave_pools, curve_pools, volatility_index, sentiment_score = (
            _fetch_all_market_data()
        )

        # Combine all opportunities
        raw_opportunities = aave_pools + curve_pools

        # 2. Prepare data summary for LLM
        opp_summary = json.dumps(
            [_opportunity_to_dict(op) for op in raw_opportunities],
            indent=2,
        )

        data_context = (
            f"Current market data:\n\n"
            f"Volatility Index: {volatility_index}\n"
            f"Sentiment Score: {sentiment_score}\n"
            f"\nAvailable yield opportunities:\n{opp_summary}\n\n"
            f"Synthesize these into a ranked opportunity list. "
            f"Return ONLY valid JSON with an 'opportunities' array."
        )

        # 3. Query LLM for synthesis
        messages = [
            SystemMessage(content=SCOUT_SYSTEM),
            HumanMessage(content=data_context),
        ]
        response = llm.invoke(messages)
        llm_text = (
            response.content
            if isinstance(response.content, str)
            else str(response.content)
        )

        # 4. Parse and filter opportunities
        opportunities = _parse_llm_response(llm_text, raw_opportunities)

        # 5. Build reasoning summary
        if opportunities:
            top_opp = opportunities[0]
            reasoning = (
                f"Found {len(opportunities)} opportunities. "
                f"Best: {top_opp['protocol']}/{top_opp['pool']} at {top_opp['apy']}% APY "
                f"(risk: {top_opp['risk_score']}). "
                f"Market vol: {volatility_index}, sentiment: {sentiment_score}."
            )
        else:
            reasoning = (
                "No viable opportunities found. "
                f"Market vol: {volatility_index}, sentiment: {sentiment_score}."
            )

        logger.info(
            "Scout node complete: %d opportunities identified", len(opportunities)
        )

    except Exception as e:
        logger.error("Scout node error (%s), returning safe defaults", e)
        opportunities = []
        volatility_index = 50.0
        sentiment_score = 0.0
        reasoning = f"Scout node encountered an error: {e}. Using safe defaults."

    return {
        "opportunities": opportunities,
        "volatility_index": volatility_index,
        "sentiment_score": sentiment_score,
        "scout_reasoning": reasoning,
    }
