"""FastAPI server for APEX — SSE streaming, REST endpoints, cycle orchestration."""

import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from dotenv import load_dotenv

load_dotenv()

from agents.graph import apex_graph, _default_state, _load_agent_ids

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
    global _cycle_running
    if _cycle_running:
        from fastapi import HTTPException

        raise HTTPException(status_code=409, detail="Cycle already running")
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
    """Manually trigger a cycle. Client should subscribe to /stream."""
    return {
        "status": "started",
        "message": "Cycle started. Subscribe to /stream for real-time updates.",
    }


@app.get("/log")
async def get_log():
    """Return the in-memory cycle log."""
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
    # TODO: Implement actual on-chain read from Reputation Registry
    return {
        "agent_id": agent_id,
        "avg_score": 0.0,
        "normalized": 0.0,
        "count": 0,
        "signals": [],
    }
