"""Executor agent — on-chain and CEX trade execution."""

from agents.graph import APEXState
from dotenv import load_dotenv

load_dotenv()


def executor_node(state: APEXState) -> dict:
    """Executor node — executes approved trades via Surge + Kraken."""
    # TODO: Implement Surge Risk Router + Kraken CLI execution
    return {
        "tx_hash": "",
        "executed_protocol": "",
        "actual_pnl": 0.0,
        "execution_error": "Executor node stub — no real execution yet.",
    }


def veto_node(state: APEXState) -> dict:
    """Veto logger node — sink node for vetoed trades."""
    return {
        "tx_hash": "",
        "executed_protocol": "",
        "actual_pnl": 0.0,
        "execution_error": "",
        "veto_count": state.get("veto_count", 0) + 1,
    }
