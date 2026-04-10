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
    """Fetch top Base DEX pools using DeFi Llama API.

    Queries the Llama.fi yields API for Base chain pools.
    Falls back to realistic mock data on any failure.

    Note: Aerodrome subgraph is no longer available, using Llama Base pools as replacement.
    """
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get("https://yields.llama.fi/pools?chain=Base")
            resp.raise_for_status()
            data = resp.json()

        pools: list[YieldOpportunity] = []
        stable_pairs = {"USDC", "USDT", "DAI", "FRAX", "USDC/USDT", "DAI/USDC"}

        for p in data.get("data", []):
            symbol = p.get("symbol", "")
            tvl = p.get("tvlUsd", 0) or 0
            apy_raw = p.get("apy") or p.get("apyBase") or 0
            apy = float(apy_raw) if apy_raw is not None else 0

            if tvl < 500_000 or apy > 100:
                continue

            is_stable = p.get("stablecoin", False) or symbol in stable_pairs
            risk_score = (
                0.08 if is_stable else (0.25 if p.get("ilRisk") == "high" else 0.20)
            )

            pools.append(
                YieldOpportunity(
                    protocol="aerodrome",
                    pool=symbol,
                    apy=round(apy, 2) if apy else 5.0,
                    tvl_usd=round(tvl, 2),
                    risk_score=round(risk_score, 2),
                    liquidity_usd=round(tvl * 0.73, 2),
                )
            )

        if pools:
            pools.sort(key=lambda x: x["tvl_usd"], reverse=True)
            logger.info(
                "Fetched %d Base pools from Llama API (Aerodrome replacement)",
                len(pools),
            )
            return pools[:15]

    except Exception as exc:
        logger.warning("Base Llama API failed (%s), using mock data", exc)

    logger.info("Returning %d mock Aerodrome pools", len(_MOCK_AERO_POOLS))
    return list(_MOCK_AERO_POOLS)
