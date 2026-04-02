"""Aerodrome Finance pool data for APEX yield optimizer.

Queries the Aerodrome subgraph (Goldsky) for top liquidity pools
on Base network, converting them to YieldOpportunity format.

Falls back to realistic mock data on any failure.
"""

import logging
import os
from typing import TypedDict

import httpx

from agents.graph import YieldOpportunity

logger = logging.getLogger(__name__)

TIMEOUT = httpx.Timeout(10.0)
SUBGRAPH_URL = os.environ.get(
    "AERODROME_SUBGRAPH_URL",
    "https://api.goldsky.com/api/public/project_clwhqj4y9a8bq01z0g2w5b0ql/subgraphs/aerodrome-finance-aerodrome-base-mainnet/1.0.0/gn",
)

_GRAPHQL_QUERY = """
{
  pools(
    first: 20
    orderBy: reserveUSD
    orderDirection: desc
    where: { reserveUSD_gt: "500000" }
  ) {
    id
    token0 { symbol }
    token1 { symbol }
    reserveUSD
    volumeUSD
    feeAPR
    totalSupply
  }
}
"""

_MOCK_AERO_POOLS: list[YieldOpportunity] = [
    YieldOpportunity(
        protocol="aerodrome",
        pool="WETH/USDC",
        apy=12.5,
        tvl_usd=52_000_000,
        risk_score=0.20,
        liquidity_usd=38_000_000,
    ),
    YieldOpportunity(
        protocol="aerodrome",
        pool="USDC/USDT",
        apy=4.8,
        tvl_usd=28_000_000,
        risk_score=0.08,
        liquidity_usd=25_000_000,
    ),
    YieldOpportunity(
        protocol="aerodrome",
        pool="cbETH/WETH",
        apy=6.2,
        tvl_usd=18_000_000,
        risk_score=0.25,
        liquidity_usd=13_000_000,
    ),
    YieldOpportunity(
        protocol="aerodrome",
        pool="AERO/WETH",
        apy=28.4,
        tvl_usd=12_000_000,
        risk_score=0.45,
        liquidity_usd=8_500_000,
    ),
    YieldOpportunity(
        protocol="aerodrome",
        pool="DAI/USDC",
        apy=3.9,
        tvl_usd=8_500_000,
        risk_score=0.10,
        liquidity_usd=7_800_000,
    ),
]


async def fetch_aerodrome_pools() -> list[YieldOpportunity]:
    """Fetch top Aerodrome pools on Base by TVL.

    Queries the subgraph via GraphQL, parses pool data, and converts
    to YieldOpportunity format with computed risk scores.

    Returns mock data on any failure for demo reliability.
    """
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                SUBGRAPH_URL,
                json={"query": _GRAPHQL_QUERY},
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()

        pool_data = data.get("data", {}).get("pools", [])
        if not pool_data:
            logger.info("No pools returned from Aerodrome subgraph, using mock")
            return list(_MOCK_AERO_POOLS)

        pools: list[YieldOpportunity] = []
        for p in pool_data:
            tvl = float(p.get("reserveUSD", 0))
            token0 = p.get("token0", {}).get("symbol", "?")
            token1 = p.get("token1", {}).get("symbol", "?")
            fee_apr = float(p.get("feeAPR", 0))

            if tvl < 500_000:
                continue

            # APY from fee APR + estimated emissions (rough multiplier)
            apy = fee_apr * 100 * 1.5

            # Risk score: low TVL = higher risk, stable pairs = lower risk
            stable_pair = {token0.upper(), token1.upper()} <= {"USDC", "USDT", "DAI"}
            base_risk = max(0.05, min(0.5, 1.0 - (tvl / 100_000_000)))
            risk_score = base_risk * (0.7 if stable_pair else 1.0)

            pools.append(
                YieldOpportunity(
                    protocol="aerodrome",
                    pool=f"{token0}/{token1}",
                    apy=round(apy, 2),
                    tvl_usd=round(tvl, 2),
                    risk_score=round(risk_score, 2),
                    liquidity_usd=round(tvl * 0.73, 2),
                )
            )

        if pools:
            logger.info("Fetched %d Aerodrome pools from subgraph", len(pools))
            return pools

    except Exception as exc:
        logger.warning("Aerodrome subgraph failed (%s), using mock data", exc)

    logger.info("Returning %d mock Aerodrome pools", len(_MOCK_AERO_POOLS))
    return list(_MOCK_AERO_POOLS)
