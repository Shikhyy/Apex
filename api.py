"""FastAPI server for APEX — SSE streaming, REST endpoints, cycle orchestration."""

import asyncio
import json
import os
import re
import sys
import time
import uuid
from contextlib import suppress
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from dotenv import load_dotenv

# Make imports resilient on platforms where uvicorn starts from a different cwd.
APP_ROOT = os.path.dirname(os.path.abspath(__file__))
LIB_ROOT = os.path.join(APP_ROOT, "lib")
if APP_ROOT not in sys.path:
    sys.path.insert(0, APP_ROOT)
if LIB_ROOT not in sys.path:
    sys.path.insert(0, LIB_ROOT)

load_dotenv()

from agents.graph import apex_graph, _default_state, _load_agent_ids
from mcp_tools.risk_analysis import fetch_agent_reputation, fetch_reputation_signals
from mcp_tools.social import auto_share_cycle, get_social_stats
from db import get_db
import logging

logger = logging.getLogger(__name__)

app = FastAPI(title="APEX", version="1.0.0")


def _parse_cors_origins() -> list[str]:
    configured = os.environ.get("CORS_ALLOW_ORIGINS", "").strip()
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory cycle log
cycle_log: list[dict] = []
MAX_CYCLE_LOG_ITEMS = int(os.environ.get("APEX_MAX_CYCLE_LOG_ITEMS", "500"))
MAX_STREAM_REPLAY_ITEMS = int(os.environ.get("APEX_MAX_STREAM_REPLAY_ITEMS", "5"))
_cycle_running = False
_last_cycle_time: float = 0
CYCLE_COOLDOWN_SECONDS = 5
AUTO_TRADER_ENABLED = os.environ.get("APEX_AUTOTRADE_ENABLED", "true").strip().lower() not in {
    "0",
    "false",
    "no",
    "off",
}
AUTO_TRADER_INTERVAL_SECONDS = float(
    os.environ.get("APEX_AUTOTRADE_INTERVAL_SECONDS", "60")
)
AUTONOMOUS_STRICT_MODE = os.environ.get(
    "APEX_AUTONOMOUS_STRICT_MODE", "true"
).strip().lower() not in {"0", "false", "no", "off"}
cycle_subscribers: set[tuple[asyncio.Queue[dict], Optional[str]]] = set()
_autotrader_task: asyncio.Task | None = None

IDENTITY_REGISTRY = os.environ.get(
    "IDENTITY_REGISTRY_ADDRESS",
    "0x97b07dDc405B0c28B17559aFFE63BdB3632d0ca3",
)


class CycleResponse(BaseModel):
    status: str
    message: str


class ErrorResponse(BaseModel):
    error: str
    detail: str
    status: int


class TriggerCycleRequest(BaseModel):
    user_wallet: Optional[str] = None


def _normalize_wallet_address(wallet: Optional[str]) -> Optional[str]:
    if wallet is None:
        return None
    normalized = wallet.strip().lower()
    if not normalized:
        return None
    if not re.fullmatch(r"0x[a-f0-9]{40}", normalized):
        raise HTTPException(status_code=400, detail="Invalid user_wallet address format")
    return normalized


def _format_cycle_event(payload: dict) -> str:
    return f"event: {payload['node']}\ndata: {json.dumps(payload)}\n\n"


def _persist_cycle_event(
    node_name: str,
    timestamp: str,
    data: dict,
    cycle_number: int,
    user_wallet: Optional[str] = None,
) -> None:
    try:
        get_db().insert_cycle_event(
            node_name,
            timestamp,
            data,
            cycle_number,
            user_wallet=user_wallet,
        )
    except Exception as exc:
        print(f"[APEX] Failed to persist {node_name} event: {exc}")


def _broadcast_cycle_event(payload: dict) -> None:
    payload_wallet = _normalize_wallet_address(payload.get("user_wallet"))
    for queue, subscriber_wallet in list(cycle_subscribers):
        if subscriber_wallet is not None and subscriber_wallet != payload_wallet:
            continue
        try:
            queue.put_nowait(payload)
        except Exception:
            cycle_subscribers.discard((queue, subscriber_wallet))


async def _execute_cycle(user_wallet: Optional[str] = None) -> None:
    """Run a single APEX cycle and publish SSE events to subscribers."""
    global cycle_log, _cycle_running

    normalized_wallet = _normalize_wallet_address(user_wallet)
    state = _default_state()
    if normalized_wallet is not None:
        state["user_wallet"] = normalized_wallet

    state["cycle_number"] = (
        len(
            [
                c
                for c in cycle_log
                if c.get("node") == "done"
                and _normalize_wallet_address(c.get("user_wallet")) == normalized_wallet
            ]
        )
        + 1
    )

    config = {"configurable": {"thread_id": str(uuid.uuid4())}}
    _cycle_running = True

    try:
        async for event in apex_graph.astream(state, config=config):
            for node_name, node_output in event.items():
                ts = datetime.now(timezone.utc).isoformat()
                ranked_intents = node_output.get("ranked_intents", [])
                top_intent = ranked_intents[0] if isinstance(ranked_intents, list) and ranked_intents else None
                compact_top_intent = None
                if isinstance(top_intent, dict):
                    opp = top_intent.get("opportunity", {}) if isinstance(top_intent.get("opportunity", {}), dict) else {}
                    compact_top_intent = {
                        "amount_usd": top_intent.get("amount_usd"),
                        "eip712_signature": top_intent.get("eip712_signature"),
                        "intent_hash": top_intent.get("intent_hash"),
                        "opportunity": {
                            "protocol": opp.get("protocol"),
                            "pool": opp.get("pool"),
                        },
                    }

                sse_event = {
                    "node": node_name,
                    "timestamp": ts,
                    "data": {
                        "guardian_decision": node_output.get("guardian_decision"),
                        "guardian_reason": node_output.get("guardian_reason"),
                        "guardian_detail": node_output.get("guardian_detail"),
                        "guardian_confidence": node_output.get("guardian_confidence"),
                        "tx_hash": node_output.get("tx_hash"),
                        "actual_pnl": node_output.get("actual_pnl"),
                        "execution_error": node_output.get("execution_error"),
                        "execution_mode": node_output.get("execution_mode"),
                        "executed_protocol": node_output.get("executed_protocol"),
                        "executing_wallet": node_output.get("executing_wallet"),
                        "volatility_index": node_output.get("volatility_index"),
                        "sentiment_score": node_output.get("sentiment_score"),
                        "opportunities_count": len(node_output.get("opportunities", [])) if isinstance(node_output.get("opportunities", []), list) else 0,
                        "ranked_intents_count": len(ranked_intents) if isinstance(ranked_intents, list) else 0,
                        "ranked_intents": [compact_top_intent] if compact_top_intent else [],
                        "user_wallet": node_output.get("user_wallet"),
                    },
                    "user_wallet": normalized_wallet,
                }
                cycle_log.append(
                    {
                        "node": node_name,
                        "timestamp": ts,
                        "data": sse_event["data"],
                        "user_wallet": normalized_wallet,
                    }
                )
                if len(cycle_log) > MAX_CYCLE_LOG_ITEMS:
                    del cycle_log[:-MAX_CYCLE_LOG_ITEMS]
                _persist_cycle_event(
                    node_name,
                    ts,
                    sse_event["data"],
                    state.get("cycle_number", 0),
                    user_wallet=normalized_wallet,
                )
                _broadcast_cycle_event(sse_event)

                # Update session metrics on guardian completion
                if node_name == "guardian":
                    decision = node_output.get("guardian_decision", "")
                    if decision == "VETOED":
                        state["veto_count"] = state.get("veto_count", 0) + 1
                    elif decision == "APPROVED":
                        state["approval_count"] = state.get("approval_count", 0) + 1

                if node_name in ("executor", "veto"):
                    if node_name == "executor":
                        state["actual_pnl"] = node_output.get("actual_pnl", 0.0)
                        state["session_pnl"] = (
                            state.get("session_pnl", 0.0) + state["actual_pnl"]
                        )
                    state["cycle_number"] = state.get("cycle_number", 0)

        # Increment session cycle counter
        try:
            from api import _get_session_manager
            manager = _get_session_manager()
            manager.increment_cycle()
        except Exception as e:
            print(f"[APEX] Failed to increment cycle count: {e}")

        # Final done event
        done_event = {
            "node": "done",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": {
                "session_pnl": state.get("session_pnl", 0.0),
                "veto_count": state.get("veto_count", 0),
                "approval_count": state.get("approval_count", 0),
                "cycle_number": state.get("cycle_number", 0),
                "user_wallet": normalized_wallet,
            },
            "user_wallet": normalized_wallet,
        }
        cycle_log.append(done_event)
        if len(cycle_log) > MAX_CYCLE_LOG_ITEMS:
            del cycle_log[:-MAX_CYCLE_LOG_ITEMS]
        _persist_cycle_event(
            "done",
            done_event["timestamp"],
            done_event["data"],
            state.get("cycle_number", 0),
            user_wallet=normalized_wallet,
        )
        _broadcast_cycle_event(done_event)

    except Exception as exc:
        print(f"[APEX] Cycle execution failed: {exc}")

    finally:
        _cycle_running = False


async def _stream_cycle_events(user_wallet: Optional[str] = None) -> AsyncGenerator[str, None]:
    """Stream existing and future cycle events as SSE."""
    normalized_wallet = _normalize_wallet_address(user_wallet)
    queue: asyncio.Queue[dict] = asyncio.Queue()
    subscription = (queue, normalized_wallet)
    cycle_subscribers.add(subscription)

    try:
        matching_history = [
            item
            for item in cycle_log
            if normalized_wallet is None
            or _normalize_wallet_address(item.get("user_wallet")) == normalized_wallet
        ]
        for item in matching_history[-MAX_STREAM_REPLAY_ITEMS:]:
            yield _format_cycle_event(
                {"node": item["node"], "timestamp": item["timestamp"], "data": item["data"]}
            )

        while True:
            payload = await queue.get()
            yield _format_cycle_event(payload)
    finally:
        cycle_subscribers.discard(subscription)


async def _autotrader_loop() -> None:
    """Continuously launch cycles on an interval while the backend is running."""
    while True:
        wallet_targets = sorted(
            {
                subscriber_wallet
                for _, subscriber_wallet in cycle_subscribers
                if subscriber_wallet
            }
        )

        if not _cycle_running and wallet_targets:
            for wallet in wallet_targets:
                if _cycle_running:
                    break
                await _execute_cycle(user_wallet=wallet)
        elif not _cycle_running and not AUTONOMOUS_STRICT_MODE:
            await _execute_cycle()

        try:
            await asyncio.sleep(AUTO_TRADER_INTERVAL_SECONDS)
        except asyncio.CancelledError:
            break


@app.on_event("startup")
async def _start_autotrader() -> None:
    global _autotrader_task
    if AUTO_TRADER_ENABLED and (_autotrader_task is None or _autotrader_task.done()):
        _autotrader_task = asyncio.create_task(_autotrader_loop())
    
    # Run startup health checks
    try:
        try:
            from lib.health_check import run_all_checks, log_health_summary
        except ModuleNotFoundError:
            import sys

            lib_path = os.path.join(os.path.dirname(__file__), "lib")
            if lib_path not in sys.path:
                sys.path.insert(0, lib_path)
            from health_check import run_all_checks, log_health_summary
        results, critical_ok = await run_all_checks()
        log_health_summary(results)
        if not critical_ok:
            logger.warning("⚠️  Some critical health checks failed. Trading may be limited.")
    except Exception as e:
        logger.error(f"Health check failed to run: {e}")

@app.on_event("shutdown")
async def _stop_autotrader() -> None:
    global _autotrader_task
    if _autotrader_task is not None:
        _autotrader_task.cancel()
        with suppress(asyncio.CancelledError):
            await _autotrader_task
        _autotrader_task = None


@app.get("/")
async def root():
    """APEX backend root endpoint."""
    return {
        "name": "APEX Backend",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "health": "/health",
        "stream": "/stream",
    }


@app.get("/health")
async def health():
    groq_primary_set = bool(os.environ.get("GROQ_API_KEY"))
    groq_fallback_set = bool(os.environ.get("GROQ_API_KEY_FALLBACK"))
    gemini_set = bool(os.environ.get("GEMINI_API_KEY"))
    llm_set = groq_primary_set or groq_fallback_set or gemini_set
    key_set = bool(os.environ.get("APEX_PRIVATE_KEY"))
    ids = _load_agent_ids()
    ids_loaded = all(v and v > 0 for v in ids.values())
    rpc_url = os.environ.get("SEPOLIA_RPC_URL") or os.environ.get("BASE_SEPOLIA_RPC")
    rpc_connected = False
    if rpc_url:
        try:
            from web3 import Web3

            rpc_connected = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 5})).is_connected()
        except Exception:
            rpc_connected = False

    return {
        "status": "ok",
        "llm_key_set": llm_set,
        "groq_key_set": groq_primary_set,
        "groq_fallback_key_set": groq_fallback_set,
        "gemini_key_set": gemini_set,
        "apex_private_key_set": key_set,
        "agent_ids_loaded": ids_loaded,
        "autotrader_enabled": AUTO_TRADER_ENABLED,
        "autotrader_running": _autotrader_task is not None and not _autotrader_task.done(),
        "base_rpc_connected": rpc_connected,
    }


@app.get("/stream")
async def stream(user_wallet: Optional[str] = None):
    """SSE stream of agent decisions."""
    normalized_wallet = _normalize_wallet_address(user_wallet)
    return StreamingResponse(
        _stream_cycle_events(normalized_wallet),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/cycle")
async def trigger_cycle(request: Optional[TriggerCycleRequest] = None):
    """Manually trigger a cycle. Events are appended to /log in real time."""
    global _cycle_running, _last_cycle_time

    if AUTONOMOUS_STRICT_MODE:
        raise HTTPException(
            status_code=403,
            detail=(
                "Manual cycle trigger is disabled in autonomous mode. "
                "Connect wallet and use autonomous agent pipeline."
            ),
        )

    requested_wallet = _normalize_wallet_address(
        request.user_wallet if request is not None else None
    )
    if requested_wallet is None:
        raise HTTPException(
            status_code=400,
            detail="user_wallet is required. Connect wallet and retry.",
        )

    if _cycle_running:
        raise HTTPException(status_code=409, detail="Cycle already running")

    now = time.time()
    if now - _last_cycle_time < CYCLE_COOLDOWN_SECONDS:
        remaining = CYCLE_COOLDOWN_SECONDS - (now - _last_cycle_time)
        raise HTTPException(
            status_code=429,
            detail=f"Rate limited. Try again in {remaining:.0f}s.",
        )
    _last_cycle_time = now
    _cycle_running = True
    asyncio.create_task(_execute_cycle(user_wallet=requested_wallet))
    return {
        "status": "started",
        "message": "Cycle started for wallet. Poll /log for results.",
        "user_wallet": requested_wallet,
    }


@app.get("/log")
async def get_log(user_wallet: Optional[str] = None):
    """Return the persisted cycle log from Supabase."""
    normalized_wallet = _normalize_wallet_address(user_wallet)

    if normalized_wallet is not None:
        filtered_cycles = [
            item
            for item in cycle_log
            if _normalize_wallet_address(item.get("user_wallet")) == normalized_wallet
        ]
        return {"cycles": filtered_cycles[-100:]}

    try:
        db = get_db()
        cycles = db.get_cycle_log(limit=100)
        return {"cycles": cycles}
    except Exception:
        return {"cycles": cycle_log}


@app.get("/agents")
async def get_agents():
    """Return all registered agent IDs and metadata."""
    ids = _load_agent_ids()
    agents = [
        {
            "name": "scout",
            "agent_id": ids["scout"],
            "role": "Market Intelligence Agent",
        },
        {
            "name": "strategist",
            "agent_id": ids["strategist"],
            "role": "Trade Intent Generator",
        },
        {
            "name": "guardian",
            "agent_id": ids["guardian"],
            "role": "Risk Management & Circuit Breaker",
        },
        {
            "name": "executor",
            "agent_id": ids["executor"],
            "role": "On-Chain & CEX Trade Executor",
        },
    ]
    if ids.get("quant", 0) > 0:
        agents.append(
            {
                "name": "quant",
                "agent_id": ids["quant"],
                "role": "Portfolio Optimizer",
            }
        )
    return {
        "agents": agents,
        "network": "sepolia",
        "identity_registry": IDENTITY_REGISTRY,
    }


@app.get("/reputation/{agent_id}")
async def get_reputation(agent_id: int):
    """Fetch on-chain reputation signals for a given ERC-8004 agent."""
    result = fetch_agent_reputation(agent_id)
    result["signals"] = fetch_reputation_signals(agent_id)
    return result


@app.get("/market/prices")
async def get_market_prices():
    """Fetch real-time prices from PRISM API."""
    from mcp_tools.prism_api import fetch_prices

    prices = await fetch_prices(["BTC", "ETH", "USDC", "AERO"])
    return {"prices": prices}


@app.get("/market/signals")
async def get_market_signals_endpoint():
    """Fetch AI trading signals from PRISM API."""
    from mcp_tools.prism_api import fetch_signals

    signals = await fetch_signals(["BTC", "ETH", "AERO"])
    return {"signals": signals}


@app.get("/market/aerodrome-pools")
async def get_aerodrome_pools_endpoint():
    """Fetch top Aerodrome liquidity pools on Base."""
    from mcp_tools.aerodrome_pools import fetch_aerodrome_pools

    pools = await fetch_aerodrome_pools()
    return {
        "pools": [
            {
                "pool": p["pool"],
                "protocol": p["protocol"],
                "tvl_usd": p["tvl_usd"],
                "apy": p["apy"],
                "risk_score": p["risk_score"],
                "liquidity_usd": p["liquidity_usd"],
            }
            for p in pools
        ]
    }


class ShareCycleRequest(BaseModel):
    cycle_data: Optional[dict] = None


@app.post("/social/share-cycle")
async def share_cycle(request: Optional[ShareCycleRequest] = None):
    """Trigger auto-sharing of cycle results to social platforms."""
    cycle_data = request.cycle_data if request else None

    if cycle_data is None:
        try:
            db = get_db()
            cycles = db.get_cycle_log(limit=1)
            if cycles:
                cycle_data = cycles[-1]
        except Exception:
            pass

    if cycle_data is None:
        last = cycle_log[-1] if cycle_log else None
        if last and last.get("node") == "done":
            cycle_data = last.get("data", {})
        else:
            cycle_data = {
                "cycle_number": 0,
                "session_pnl": 0.0,
                "veto_count": 0,
                "approval_count": 0,
            }

    result = auto_share_cycle(cycle_data)
    return result


@app.get("/social/stats")
async def social_stats():
    """Return social engagement stats."""
    return get_social_stats()


# ---------------------------------------------------------------------------
# Kraken market data endpoints
# ---------------------------------------------------------------------------


@app.get("/market/kraken-ticker")
async def get_kraken_ticker(pairs: str = "BTCUSD,ETHUSD"):
    """Fetch live Kraken ticker data for specified pairs."""
    import subprocess

    pair_list = [p.strip() for p in pairs.split(",")]
    tickers = []
    for pair in pair_list:
        try:
            kraken_bin = subprocess.run(
                ["kraken", "ticker", pair],
                capture_output=True,
                text=True,
                timeout=15,
            )
            if kraken_bin.returncode == 0:
                import json as _json

                tickers.append(_json.loads(kraken_bin.stdout))
            else:
                from mcp_tools.execution import kraken_fetch_ticker

                tickers.append(kraken_fetch_ticker(pair))
        except Exception as e:
            from mcp_tools.execution import kraken_fetch_ticker

            tickers.append(kraken_fetch_ticker(pair))
    return {"tickers": tickers}


@app.get("/market/kraken-orderbook")
async def get_kraken_orderbook(pair: str = "BTCUSD", count: int = 10):
    """Fetch Kraken order book for a trading pair."""
    import httpx as _httpx

    try:
        async with _httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.kraken.com/0/public/Depth",
                params={"pair": pair, "count": count},
            )
            resp.raise_for_status()
            data = resp.json()
            if "error" in data and data["error"]:
                raise HTTPException(status_code=400, detail=str(data["error"]))
            return {"pair": pair, "orderbook": data.get("result", {})}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=502, detail=f"Failed to fetch orderbook: {str(e)}"
        )


@app.get("/market/kraken-ohlc")
async def get_kraken_ohlc(pair: str = "BTCUSD", interval: int = 60):
    """Fetch OHLC candles from Kraken."""
    import httpx as _httpx

    try:
        async with _httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.kraken.com/0/public/OHLC",
                params={"pair": pair, "interval": interval},
            )
            resp.raise_for_status()
            data = resp.json()
            if "error" in data and data["error"]:
                raise HTTPException(status_code=400, detail=str(data["error"]))
            result = data.get("result", {})
            candles = []
            for key, values in result.items():
                if key == "last":
                    continue
                for v in values:
                    candles.append(
                        {
                            "time": int(v[0]),
                            "open": float(v[1]),
                            "high": float(v[2]),
                            "low": float(v[3]),
                            "close": float(v[4]),
                            "vwap": float(v[5]),
                            "volume": float(v[6]),
                            "count": int(v[7]),
                        }
                    )
            return {"pair": pair, "interval": interval, "candles": candles}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=502, detail=f"Failed to fetch OHLC data: {str(e)}"
        )


@app.get("/market/compound-rates")
async def get_compound_rates():
    """Fetch Compound V3 supply rates."""
    from mcp_tools.market_data import fetch_compound_rates

    rates = await fetch_compound_rates()
    return {
        "rates": [
            {
                "protocol": r["protocol"],
                "pool": r["pool"],
                "apy": r["apy"],
                "tvl_usd": r["tvl_usd"],
                "risk_score": r["risk_score"],
                "liquidity_usd": r["liquidity_usd"],
            }
            for r in rates
        ]
    }


@app.get("/market/volatility")
async def get_volatility():
    """Fetch market volatility index (0-100 scale)."""
    from mcp_tools.market_data import fetch_volatility_index

    vol = await fetch_volatility_index()
    return {"volatility_index": vol}


@app.get("/market/sentiment")
async def get_sentiment():
    """Fetch market sentiment score (-1.0 to +1.0)."""
    from mcp_tools.market_data import fetch_sentiment

    sentiment = await fetch_sentiment()
    return {"sentiment_score": sentiment}


# ---------------------------------------------------------------------------
# Paper trading endpoints
# ---------------------------------------------------------------------------


@app.get("/paper/status")
async def get_paper_status():
    """Get Kraken paper trading account status."""
    from mcp_tools.execution import kraken_paper_status

    status = kraken_paper_status()
    return status


@app.get("/paper/history")
async def get_paper_history():
    """Get paper trade history."""
    from mcp_tools import execution as _execution_module

    portfolio = _execution_module._paper_portfolio
    trades = portfolio.get("trades", []) if portfolio else []
    return {"trades": trades, "total_trades": len(trades)}


@app.post("/paper/buy")
async def paper_buy(pair: str = "BTCUSD", volume: float = 0.001):
    """Place a paper buy order."""
    from mcp_tools.execution import (
        kraken_fetch_ticker,
        kraken_paper_buy,
        kraken_paper_init,
    )

    try:
        ticker = kraken_fetch_ticker(pair)
        price = ticker.get("price", 0)
        if price <= 0:
            raise HTTPException(status_code=400, detail=f"Invalid price for {pair}")

        amount_usd = volume * price
        result = kraken_paper_buy(pair, amount_usd, price)
        if result.get("status") == "failed":
            raise HTTPException(
                status_code=400, detail=result.get("error", "Buy failed")
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Paper buy failed: {str(e)}")


@app.post("/paper/sell")
async def paper_sell(pair: str = "BTCUSD", volume: float = 0.001):
    """Place a paper sell order."""
    from mcp_tools.execution import kraken_fetch_ticker, kraken_paper_sell

    try:
        ticker = kraken_fetch_ticker(pair)
        price = ticker.get("price", 0)
        if price <= 0:
            raise HTTPException(status_code=400, detail=f"Invalid price for {pair}")

        result = kraken_paper_sell(pair, volume, price)
        if result.get("status") == "failed":
            raise HTTPException(
                status_code=400, detail=result.get("error", "Sell failed")
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Paper sell failed: {str(e)}")


# ---------------------------------------------------------------------------
# PnL Dashboard Endpoints (NEW)
# ---------------------------------------------------------------------------

# Global session manager instance
_session_manager = None


def _get_session_manager():
    """Get or initialize session manager."""
    global _session_manager
    if _session_manager is None:
        try:
            from lib.session_manager import SessionManager
        except ModuleNotFoundError:
            import sys

            lib_path = os.path.join(os.path.dirname(__file__), "lib")
            if lib_path not in sys.path:
                sys.path.insert(0, lib_path)
            from session_manager import SessionManager
        _session_manager = SessionManager(starting_balance_usd=0.0)
    return _session_manager


@app.get("/pnl/session")
async def get_pnl_session():
    """Get current session metrics (cumulative PnL, drawdown, Sharpe, etc.)."""
    manager = _get_session_manager()
    metrics = manager.get_session_metrics()
    return dict(metrics)


@app.get("/pnl/trades")
async def get_pnl_trades(limit: int = 100):
    """Get executed trade history with P&L details."""
    manager = _get_session_manager()
    trades = manager.trades[-limit:]
    return {
        "total_count": len(manager.trades),
        "trades": [dict(t) for t in trades],
    }


@app.get("/pnl/trades/history")
async def get_trade_history(session_id: Optional[str] = None, limit: int = 100):
    """Get executed trade history from persistent storage."""
    try:
        db = get_db()
        trades = db.get_executed_trades(session_id=session_id, limit=limit)
        return {
            "total_count": len(trades),
            "trades": trades,
            "session_id": session_id,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch trade history: {str(e)}")


@app.get("/pnl/positions")
async def get_pnl_positions():
    """Get current open positions with unrealized P&L."""
    manager = _get_session_manager()
    positions = {
        pair: dict(pos)
        for pair, pos in manager.open_positions.items()
    }
    
    # Calculate total unrealized
    total_unrealized = sum(
        pos.get("unrealized_pnl", 0)
        for pos in manager.open_positions.values()
    )
    
    return {
        "open_count": len(positions),
        "total_unrealized_pnl": round(total_unrealized, 2),
        "positions": positions,
    }


@app.get("/pnl/chart")
async def get_pnl_chart():
    """Get time-series PnL data for charting cumulative return."""
    manager = _get_session_manager()
    
    # Build cumulative PnL over time
    chart_data = []
    cumulative = 0.0
    
    for trade in manager.trades:
        cumulative += trade.get("net_pnl", 0)
        chart_data.append({
            "timestamp": trade.get("timestamp", 0),
            "cumulative_pnl": round(cumulative, 2),
            "pair": trade.get("pair", "unknown"),
            "pnl": round(trade.get("net_pnl", 0), 2),
        })
    
    return {
        "data": chart_data,
        "peak": round(manager.peak_pnl, 2),
        "current": round(manager.cumulative_pnl, 2),
        "drawdown_pct": round(manager.get_current_drawdown_pct(), 2),
    }


@app.post("/emergency-stop")
async def emergency_stop():
    """Emergency halt — stops all trading cycles and pending trades."""
    global _cycle_running
    _cycle_running = False
    
    manager = _get_session_manager()
    manager.circuit_breaker_active = True
    manager.halt_reason = "Emergency stop triggered by user"
    
    logger.warning("[EMERGENCY STOP] All trading halted immediately")
    
    return {
        "status": "halted",
        "reason": "Emergency stop triggered",
        "halt_reason": manager.halt_reason,
    }
