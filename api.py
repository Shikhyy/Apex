"""FastAPI server for APEX — SSE streaming, REST endpoints, cycle orchestration."""

import asyncio
import json
import os
import time
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from dotenv import load_dotenv

load_dotenv()

from agents.graph import apex_graph, _default_state, _load_agent_ids
from mcp_tools.risk_analysis import fetch_agent_reputation, fetch_reputation_signals
from mcp_tools.social import auto_share_cycle, get_social_stats
from db import get_db

app = FastAPI(title="APEX", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory cycle log
cycle_log: list[dict] = []
_cycle_running = False
_last_cycle_time: float = 0
CYCLE_COOLDOWN_SECONDS = 5

IDENTITY_REGISTRY = os.environ.get(
    "IDENTITY_REGISTRY_ADDRESS",
    "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
)


class CycleResponse(BaseModel):
    status: str
    message: str


class ErrorResponse(BaseModel):
    error: str
    detail: str
    status: int


async def _run_cycle() -> AsyncGenerator[str, None]:
    """Run a single APEX cycle and yield SSE events."""
    global cycle_log, _cycle_running

    state = _default_state()
    state["cycle_number"] = len([c for c in cycle_log if c.get("node") == "done"]) + 1

    config = {"configurable": {"thread_id": str(uuid.uuid4())}}

    try:
        async for event in apex_graph.astream(state, config=config):
            for node_name, node_output in event.items():
                ts = datetime.now(timezone.utc).isoformat()
                sse_event = {
                    "node": node_name,
                    "timestamp": ts,
                    "data": {
                        k: v
                        for k, v in node_output.items()
                        if k
                        in (
                            "guardian_decision",
                            "guardian_reason",
                            "guardian_detail",
                            "guardian_confidence",
                            "tx_hash",
                            "actual_pnl",
                            "execution_error",
                            "opportunities",
                            "ranked_intents",
                            "volatility_index",
                            "sentiment_score",
                            "scout_reasoning",
                            "strategist_reasoning",
                        )
                    },
                }
                cycle_log.append(
                    {"node": node_name, "timestamp": ts, "data": sse_event["data"]}
                )
                get_db().insert_cycle_event(
                    node_name, ts, sse_event["data"], state.get("cycle_number", 0)
                )
                yield f"data: {json.dumps(sse_event)}\n\n"

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

        # Final done event
        done_event = {
            "node": "done",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": {
                "session_pnl": state.get("session_pnl", 0.0),
                "veto_count": state.get("veto_count", 0),
                "approval_count": state.get("approval_count", 0),
                "cycle_number": state.get("cycle_number", 0),
            },
        }
        cycle_log.append(done_event)
        get_db().insert_cycle_event(
            "done",
            done_event["timestamp"],
            done_event["data"],
            state.get("cycle_number", 0),
        )
        yield f"data: {json.dumps(done_event)}\n\n"

    finally:
        _cycle_running = False


@app.get("/health")
async def health():
    groq_set = bool(os.environ.get("GROQ_API_KEY"))
    key_set = bool(os.environ.get("APEX_PRIVATE_KEY"))
    ids = _load_agent_ids()
    ids_loaded = all(v and v > 0 for v in ids.values())

    return {
        "status": "ok",
        "groq_key_set": groq_set,
        "apex_private_key_set": key_set,
        "agent_ids_loaded": ids_loaded,
        "base_rpc_connected": True,
    }


@app.get("/stream")
async def stream():
    """SSE stream of agent decisions."""
    global _cycle_running, _last_cycle_time
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
    return StreamingResponse(
        _run_cycle(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/cycle")
async def trigger_cycle():
    """Manually trigger a cycle. Events are appended to /log in real time."""
    global _cycle_running, _last_cycle_time
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

    async def _run_and_reset():
        try:
            async for _ in _run_cycle():
                pass  # Consume the generator so events are yielded and logged
        finally:
            _cycle_running = False

    asyncio.create_task(_run_and_reset())
    return {
        "status": "started",
        "message": "Cycle started. Poll /log for results.",
    }


@app.get("/log")
async def get_log():
    """Return the persisted cycle log from Supabase."""
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
    return {
        "agents": agents,
        "network": "base-sepolia",
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
    from mcp_tools.execution import _paper_portfolio

    trades = _paper_portfolio.get("trades", []) if _paper_portfolio else []
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
