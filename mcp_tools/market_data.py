"""Market data tools for APEX yield optimizer.

Fetches real-time DeFi market data from external APIs with graceful
fallback to realistic mock data for demo reliability.
"""

import logging
from typing import Any

import httpx

from agents.graph import YieldOpportunity

logger = logging.getLogger(__name__)

TIMEOUT = httpx.Timeout(10.0)

# ---------------------------------------------------------------------------
# Aave V3 yields
# ---------------------------------------------------------------------------

_MOCK_AAVE_POOLS: list[YieldOpportunity] = [
    YieldOpportunity(
        protocol="aave",
        pool="USDC-v3",
        apy=4.23,
        tvl_usd=2_400_000_000,
        risk_score=0.15,
        liquidity_usd=1_800_000_000,
    ),
    YieldOpportunity(
        protocol="aave",
        pool="USDT-v3",
        apy=5.10,
        tvl_usd=1_900_000_000,
        risk_score=0.18,
        liquidity_usd=1_400_000_000,
    ),
    YieldOpportunity(
        protocol="aave",
        pool="DAI-v3",
        apy=4.55,
        tvl_usd=1_200_000_000,
        risk_score=0.16,
        liquidity_usd=900_000_000,
    ),
]


async def fetch_aave_yields() -> list[YieldOpportunity]:
    """Fetch Aave V3 pool data (supply APY, TVL, utilization).

    Tries the Aave V2 liquidity endpoint first. On any failure
    (network, JSON, unexpected schema) returns realistic mock data
    so the demo never breaks.
    """
    url = "https://aave-api-v2.aave.com/data/liquidity/v2"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        pools: list[YieldOpportunity] = []
        reserves = data.get("data", {}).get("reserves", [])
        for r in reserves:
            if not r.get("isActive"):
                continue
            symbol = r.get("symbol", "UNKNOWN")
            supply_rate = float(r.get("liquidityRate", 0)) / 1e27
            apy = supply_rate * 100 if supply_rate > 0 else 0.0
            tvl = float(r.get("totalLiquidity", 0))
            utilization = float(r.get("utilizationRate", 0)) / 1e27

            if tvl < 500_000:
                continue

            pools.append(
                YieldOpportunity(
                    protocol="aave",
                    pool=f"{symbol}-v3",
                    apy=round(apy, 2),
                    tvl_usd=round(tvl, 2),
                    risk_score=round(min(0.3, 0.1 + utilization * 0.2), 2),
                    liquidity_usd=round(tvl * 0.75, 2),
                )
            )

        if pools:
            logger.info("Fetched %d Aave pools from API", len(pools))
            return pools

    except Exception as exc:
        logger.warning("Aave API failed (%s), using mock data", exc)

    logger.info("Returning %d mock Aave pools", len(_MOCK_AAVE_POOLS))
    return list(_MOCK_AAVE_POOLS)


# ---------------------------------------------------------------------------
# Curve Finance pools
# ---------------------------------------------------------------------------

_MOCK_CURVE_POOLS: list[YieldOpportunity] = [
    YieldOpportunity(
        protocol="curve",
        pool="3pool",
        apy=3.85,
        tvl_usd=850_000_000,
        risk_score=0.12,
        liquidity_usd=620_000_000,
    ),
    YieldOpportunity(
        protocol="curve",
        pool="stETH",
        apy=4.12,
        tvl_usd=1_500_000_000,
        risk_score=0.20,
        liquidity_usd=1_100_000_000,
    ),
    YieldOpportunity(
        protocol="curve",
        pool="frxETH",
        apy=5.30,
        tvl_usd=320_000_000,
        risk_score=0.25,
        liquidity_usd=240_000_000,
    ),
]


async def fetch_curve_pools() -> list[YieldOpportunity]:
    """Fetch Curve Finance pool data (APY, TVL).

    Tries the Curve registry API. Falls back to mock data on failure.
    """
    url = "https://api.curve.fi/api/getPools/ethereum/main"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        pool_data = data.get("data", {}).get("poolData", [])
        pools: list[YieldOpportunity] = []
        for p in pool_data:
            name = p.get("name", p.get("id", "unknown"))
            tvl = float(p.get("usdTotal", 0))
            apy = float(p.get("gaugeRewards", [{}])[0].get("tokenPrice", 0))
            if apy == 0:
                apy = float(p.get("rewardAPY", 0))

            if tvl < 500_000:
                continue

            pools.append(
                YieldOpportunity(
                    protocol="curve",
                    pool=name,
                    apy=round(apy * 100, 2) if apy < 1 else round(apy, 2),
                    tvl_usd=round(tvl, 2),
                    risk_score=round(min(0.35, 0.1 + (1 / max(tvl, 1)) * 1e6), 2),
                    liquidity_usd=round(tvl * 0.73, 2),
                )
            )

        if pools:
            logger.info("Fetched %d Curve pools from API", len(pools))
            return pools

    except Exception as exc:
        logger.warning("Curve API failed (%s), using mock data", exc)

    logger.info("Returning %d mock Curve pools", len(_MOCK_CURVE_POOLS))
    return list(_MOCK_CURVE_POOLS)


# ---------------------------------------------------------------------------
# Volatility index (0-100)
# ---------------------------------------------------------------------------

_MOCK_VOLATILITY = 42.3


async def fetch_volatility_index() -> float:
    """Fetch a market volatility index on a 0-100 scale.

    Tries Deribit BTC implied-volatility endpoint, then Alternative.me
    Fear & Greed (inverted: high fear = high vol). Falls back to
    a realistic mock value.
    """

    # Attempt 1: Deribit BTC 30-day implied vol
    deribit_url = "https://www.deribit.com/api/v2/public/get_volatility?currency=BTC"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(deribit_url)
            resp.raise_for_status()
            data = resp.json()
            vol = data.get("result", 0)
            if vol and isinstance(vol, (int, float)):
                return round(min(100.0, max(0.0, vol)), 2)
    except Exception as exc:
        logger.debug("Deribit volatility API failed (%s)", exc)

    # Attempt 2: Alternative.me Fear & Greed (invert: fear=100 => vol=100)
    fng_url = "https://api.alternative.me/fng/?limit=1"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(fng_url)
            resp.raise_for_status()
            data = resp.json()
            fng_value = float(data["data"][0]["value"])
            # Fear & Greed 0 (extreme fear) -> vol ~90, 100 (extreme greed) -> vol ~10
            vol = round(100.0 - fng_value, 2)
            return vol
    except Exception as exc:
        logger.debug("Fear & Greed API failed (%s)", exc)

    logger.info("Returning mock volatility index: %s", _MOCK_VOLATILITY)
    return _MOCK_VOLATILITY


# ---------------------------------------------------------------------------
# Sentiment score (-1.0 to +1.0)
# ---------------------------------------------------------------------------

_MOCK_SENTIMENT = 0.24


async def fetch_sentiment() -> float:
    """Fetch market sentiment on a -1.0 (extreme fear) to +1.0 (extreme greed) scale.

    Uses Alternative.me Fear & Greed index and maps 0-100 to -1.0..+1.0.
    Falls back to a realistic mock value.
    """
    url = "https://api.alternative.me/fng/?limit=1"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            fng_value = float(data["data"][0]["value"])
            # Map 0-100 to -1.0 to +1.0
            sentiment = round((fng_value / 50.0) - 1.0, 2)
            return sentiment
    except Exception as exc:
        logger.warning("Sentiment API failed (%s), using mock data", exc)

    logger.info("Returning mock sentiment score: %s", _MOCK_SENTIMENT)
    return _MOCK_SENTIMENT
