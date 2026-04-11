from typing import TypedDict, Literal
import json
import os

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from dotenv import load_dotenv

load_dotenv()


class YieldOpportunity(TypedDict):
    protocol: str
    pool: str
    apy: float
    tvl_usd: float
    risk_score: float
    liquidity_usd: float


class TradeIntent(TypedDict):
    opportunity: YieldOpportunity
    amount_usd: float
    expected_pnl: float
    confidence: float
    eip712_signature: str
    intent_hash: str


GuardianReason = Literal[
    "volatility_spike",
    "drawdown_limit",
    "low_scout_reputation",
    "suspicious_apy",
    "low_liquidity",
    "negative_sentiment",
    "uncertainty",
    "safe_to_proceed",
    "no_opportunities",
]


class APEXState(TypedDict):
    opportunities: list[YieldOpportunity]
    volatility_index: float
    sentiment_score: float
    scout_reasoning: str

    ranked_intents: list[TradeIntent]
    strategist_reasoning: str

    guardian_decision: Literal["APPROVED", "VETOED", "PENDING"]
    guardian_reason: GuardianReason
    guardian_detail: str
    guardian_confidence: float

    tx_hash: str
    executed_protocol: str
    actual_pnl: float
    execution_error: str

    scout_agent_id: int
    strategist_agent_id: int
    guardian_agent_id: int
    executor_agent_id: int

    session_pnl: float
    veto_count: int
    approval_count: int
    cycle_number: int
    user_wallet: str


def _load_agent_ids() -> dict[str, int]:
    """Load agent IDs from agents.json, defaulting to 0 if not yet registered."""
    path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "agents.json")
    try:
        with open(path) as f:
            data = json.load(f)
        return {
            "scout": data.get("scout") or 0,
            "strategist": data.get("strategist") or 0,
            "guardian": data.get("guardian") or 0,
            "executor": data.get("executor") or 0,
        }
    except (FileNotFoundError, json.JSONDecodeError):
        return {"scout": 0, "strategist": 0, "guardian": 0, "executor": 0}


def _default_state() -> APEXState:
    """Return a fresh APEXState with defaults."""
    ids = _load_agent_ids()
    return APEXState(
        opportunities=[],
        volatility_index=0.0,
        sentiment_score=0.0,
        scout_reasoning="",
        ranked_intents=[],
        strategist_reasoning="",
        guardian_decision="PENDING",
        guardian_reason="no_opportunities",
        guardian_detail="",
        guardian_confidence=0.0,
        tx_hash="",
        executed_protocol="",
        actual_pnl=0.0,
        execution_error="",
        scout_agent_id=ids["scout"],
        strategist_agent_id=ids["strategist"],
        guardian_agent_id=ids["guardian"],
        executor_agent_id=ids["executor"],
        session_pnl=0.0,
        veto_count=0,
        approval_count=0,
        cycle_number=0,
        user_wallet="",
    )


# --- Node wrappers that import lazily to avoid circular deps ---


def scout_node(state: APEXState) -> dict:
    from agents.scout import scout_node as _scout

    return _scout(state)


def strategist_node(state: APEXState) -> dict:
    from agents.strategist import strategist_node as _strategist

    return _strategist(state)


def guardian_node(state: APEXState) -> dict:
    from agents.guardian import guardian_node as _guardian

    return _guardian(state)


def executor_node(state: APEXState) -> dict:
    from agents.executor import executor_node as _executor

    return _executor(state)


def veto_node(state: APEXState) -> dict:
    from agents.executor import veto_node as _veto

    return _veto(state)


def guardian_router(state: APEXState) -> str:
    """Route based on Guardian decision."""
    if state.get("guardian_decision") == "APPROVED":
        return "executor"
    return "veto"


def build_graph() -> StateGraph:
    """Build and compile the APEX LangGraph StateGraph."""
    graph = StateGraph(APEXState)

    graph.add_node("scout", scout_node)
    graph.add_node("strategist", strategist_node)
    graph.add_node("guardian", guardian_node)
    graph.add_node("executor", executor_node)
    graph.add_node("veto", veto_node)

    graph.add_edge(START, "scout")
    graph.add_edge("scout", "strategist")
    graph.add_edge("strategist", "guardian")
    graph.add_conditional_edges(
        "guardian",
        guardian_router,
        {"executor": "executor", "veto": "veto"},
    )
    graph.add_edge("executor", END)
    graph.add_edge("veto", END)

    checkpointer = MemorySaver()
    return graph.compile(checkpointer=checkpointer)


apex_graph = build_graph()
