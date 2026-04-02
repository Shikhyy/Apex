"""PRISM API client for APEX yield optimizer.

Provides asset resolution, real-time prices, AI trading signals,
and risk metrics via https://api.prismapi.ai.

All functions fall back to realistic mock data on failure so the
demo never breaks.
"""

import logging
import os
from datetime import datetime, timezone
from typing import TypedDict

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://api.prismapi.ai"
TIMEOUT = httpx.Timeout(10.0)
API_KEY = os.environ.get("PRISM_API_KEY", "")


class AssetResolution(TypedDict):
    symbol: str
    name: str
    id: str
    type: str


class PriceData(TypedDict):
    symbol: str
    price: float
    change_24h: float
    timestamp: str


class SignalData(TypedDict):
    symbol: str
    signal: str
    confidence: float
    reasoning: str


class RiskData(TypedDict):
    symbol: str
    volatility: float
    risk_score: float
    sharpe_ratio: float


_MOCK_RESOLUTION: dict[str, AssetResolution] = {
    "BTC": AssetResolution(
        symbol="BTC", name="Bitcoin", id="btc-bitcoin", type="cryptocurrency"
    ),
    "ETH": AssetResolution(
        symbol="ETH", name="Ethereum", id="eth-ethereum", type="cryptocurrency"
    ),
    "USDC": AssetResolution(
        symbol="USDC", name="USD Coin", id="usd-coin", type="stablecoin"
    ),
    "AERO": AssetResolution(
        symbol="AERO", name="Aerodrome", id="aerodrome-finance", type="cryptocurrency"
    ),
}

_MOCK_PRICES: list[PriceData] = [
    PriceData(symbol="BTC", price=68400.0, change_24h=2.5, timestamp=""),
    PriceData(symbol="ETH", price=3520.0, change_24h=1.8, timestamp=""),
    PriceData(symbol="USDC", price=1.0, change_24h=0.01, timestamp=""),
    PriceData(symbol="AERO", price=1.42, change_24h=-3.2, timestamp=""),
]

_MOCK_SIGNALS: list[SignalData] = [
    SignalData(
        symbol="BTC",
        signal="BULLISH",
        confidence=0.72,
        reasoning="Strong support at $67K, rising volume",
    ),
    SignalData(
        symbol="ETH",
        signal="NEUTRAL",
        confidence=0.55,
        reasoning="Consolidating near $3.5K resistance",
    ),
    SignalData(
        symbol="AERO",
        signal="BULLISH",
        confidence=0.68,
        reasoning="Growing TVL on Base, increased swap volume",
    ),
]

_MOCK_RISK: list[RiskData] = [
    RiskData(symbol="BTC", volatility=65.2, risk_score=0.35, sharpe_ratio=1.8),
    RiskData(symbol="ETH", volatility=72.1, risk_score=0.42, sharpe_ratio=1.5),
    RiskData(symbol="USDC", volatility=2.0, risk_score=0.05, sharpe_ratio=0.9),
    RiskData(symbol="AERO", volatility=95.0, risk_score=0.65, sharpe_ratio=1.1),
]


def _now_ts() -> str:
    return datetime.now(timezone.utc).isoformat()


async def resolve_asset(symbol: str) -> AssetResolution:
    """Resolve a ticker/symbol to canonical PRISM identity.

    GET /resolve/{asset}
    """
    if not API_KEY:
        logger.warning("PRISM_API_KEY not set, using mock resolution")
        return _MOCK_RESOLUTION.get(symbol.upper(), _MOCK_RESOLUTION["BTC"])

    url = f"{BASE_URL}/resolve/{symbol}"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(url, headers={"X-API-Key": API_KEY})
            resp.raise_for_status()
            data = resp.json()
            return AssetResolution(
                symbol=data.get("symbol", symbol),
                name=data.get("name", symbol),
                id=data.get("id", ""),
                type=data.get("type", "unknown"),
            )
    except Exception as exc:
        logger.warning("PRISM resolve failed for %s (%s), using mock", symbol, exc)
        return _MOCK_RESOLUTION.get(symbol.upper(), _MOCK_RESOLUTION["BTC"])


async def fetch_prices(symbols: list[str]) -> list[PriceData]:
    """Fetch real-time prices for a list of symbols.

    GET /crypto/{symbol}/price
    """
    if not API_KEY:
        logger.warning("PRISM_API_KEY not set, using mock prices")
        ts = _now_ts()
        return [{**p, "timestamp": ts} for p in _MOCK_PRICES]

    results: list[PriceData] = []
    for sym in symbols:
        url = f"{BASE_URL}/crypto/{sym}/price"
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                resp = await client.get(url, headers={"X-API-Key": API_KEY})
                resp.raise_for_status()
                data = resp.json()
                results.append(
                    PriceData(
                        symbol=data.get("symbol", sym),
                        price=float(data.get("price", 0)),
                        change_24h=float(data.get("change_24h", 0)),
                        timestamp=data.get("timestamp", _now_ts()),
                    )
                )
        except Exception as exc:
            logger.debug("PRISM price failed for %s (%s)", sym, exc)
            for mp in _MOCK_PRICES:
                if mp["symbol"] == sym.upper():
                    results.append({**mp, "timestamp": _now_ts()})
                    break

    return results or [{**p, "timestamp": _now_ts()} for p in _MOCK_PRICES]


async def fetch_signals(symbols: list[str]) -> list[SignalData]:
    """Fetch AI trading signals for a list of symbols.

    GET /signals/{symbol}
    """
    if not API_KEY:
        logger.warning("PRISM_API_KEY not set, using mock signals")
        return _MOCK_SIGNALS

    results: list[SignalData] = []
    for sym in symbols:
        url = f"{BASE_URL}/signals/{sym}"
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                resp = await client.get(url, headers={"X-API-Key": API_KEY})
                resp.raise_for_status()
                data = resp.json()
                results.append(
                    SignalData(
                        symbol=data.get("symbol", sym),
                        signal=data.get("signal", "NEUTRAL").upper(),
                        confidence=float(data.get("confidence", 0.5)),
                        reasoning=data.get("reasoning", ""),
                    )
                )
        except Exception as exc:
            logger.debug("PRISM signal failed for %s (%s)", sym, exc)
            for ms in _MOCK_SIGNALS:
                if ms["symbol"] == sym.upper():
                    results.append(ms)
                    break

    return results or _MOCK_SIGNALS


async def fetch_risk(symbols: list[str]) -> list[RiskData]:
    """Fetch risk metrics and volatility for a list of symbols.

    GET /risk/{symbol}
    """
    if not API_KEY:
        logger.warning("PRISM_API_KEY not set, using mock risk data")
        return _MOCK_RISK

    results: list[RiskData] = []
    for sym in symbols:
        url = f"{BASE_URL}/risk/{sym}"
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                resp = await client.get(url, headers={"X-API-Key": API_KEY})
                resp.raise_for_status()
                data = resp.json()
                results.append(
                    RiskData(
                        symbol=data.get("symbol", sym),
                        volatility=float(data.get("volatility", 50)),
                        risk_score=float(data.get("risk_score", 0.5)),
                        sharpe_ratio=float(data.get("sharpe_ratio", 1.0)),
                    )
                )
        except Exception as exc:
            logger.debug("PRISM risk failed for %s (%s)", sym, exc)
            for mr in _MOCK_RISK:
                if mr["symbol"] == sym.upper():
                    results.append(mr)
                    break

    return results or _MOCK_RISK
