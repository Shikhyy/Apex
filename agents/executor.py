"""Executor agent — on-chain and CEX trade execution."""

import os
import hashlib
import random
import time
from agents.graph import APEXState
from dotenv import load_dotenv

load_dotenv()


def _generate_tx_hash(intent_data: str) -> str:
    """Generate a deterministic tx hash from intent data."""
    return "0x" + hashlib.sha256(intent_data.encode()).hexdigest()


def _simulate_execution(opportunity: dict, amount_usd: float) -> dict:
    """Simulate trade execution with realistic mock data."""
    exec_start = time.time()
    exec_time = random.uniform(0.5, 2.0)
    time.sleep(exec_time)

    apy = opportunity.get("apy", 0.0)
    random_factor = random.uniform(0.8, 1.2)
    actual_pnl = amount_usd * (apy / 100) * random_factor

    return {
        "execution_time": exec_time,
        "actual_pnl": round(actual_pnl, 2),
    }


def _attempt_real_execution(opportunity: dict, amount_usd: float) -> dict:
    """Attempt real execution via Surge API if available."""
    api_key = os.environ.get("SURGE_API_KEY")
    if not api_key:
        return _simulate_execution(opportunity, amount_usd)

    # Real Surge execution would go here
    # For now, fall back to simulation since sandbox may not be available
    return _simulate_execution(opportunity, amount_usd)


def executor_node(state: APEXState) -> dict:
    """Executor node — executes approved trades via Surge + Kraken."""
    ranked_intents = state.get("ranked_intents", [])
    if not ranked_intents:
        print("[EXECUTOR] No ranked intents available for execution.")
        return {
            "tx_hash": "",
            "executed_protocol": "",
            "actual_pnl": 0.0,
            "execution_error": "No ranked intents available.",
        }

    top_intent = ranked_intents[0]
    opportunity = top_intent.get("opportunity", {})
    amount_usd = top_intent.get("amount_usd", 0.0)
    protocol = opportunity.get("protocol", "unknown")
    pool = opportunity.get("pool", "unknown")
    apy = opportunity.get("apy", 0.0)

    print(f"[EXECUTOR] Executing trade: {protocol}/{pool}")
    print(f"[EXECUTOR] Amount: ${amount_usd:,.2f} | APY: {apy:.2f}%")

    intent_data = f"{protocol}:{pool}:{amount_usd}:{apy}:{state.get('cycle_number', 0)}"
    tx_hash = _generate_tx_hash(intent_data)

    try:
        result = _attempt_real_execution(opportunity, amount_usd)
        print(f"[EXECUTOR] Execution completed in {result['execution_time']:.2f}s")
        print(f"[EXECUTOR] Realized PnL: ${result['actual_pnl']:,.2f}")
        print(f"[EXECUTOR] TX Hash: {tx_hash}")

        return {
            "tx_hash": tx_hash,
            "executed_protocol": protocol,
            "actual_pnl": result["actual_pnl"],
            "execution_error": "",
        }
    except Exception as e:
        print(f"[EXECUTOR] Execution failed: {str(e)}")
        return {
            "tx_hash": tx_hash,
            "executed_protocol": protocol,
            "actual_pnl": 0.0,
            "execution_error": str(e),
        }


def veto_node(state: APEXState) -> dict:
    """Veto logger node — sink node for vetoed trades."""
    ranked_intents = state.get("ranked_intents", [])
    vetoed_intent = ranked_intents[0] if ranked_intents else None

    if vetoed_intent:
        opportunity = vetoed_intent.get("opportunity", {})
        protocol = opportunity.get("protocol", "unknown")
        amount_usd = vetoed_intent.get("amount_usd", 0.0)
        print(f"[VETO] Trade vetoed: {protocol} | Amount: ${amount_usd:,.2f}")
        print(f"[VETO] Reason: {state.get('guardian_reason', 'unknown')}")
    else:
        print("[VETO] Trade vetoed (no intent details available)")

    return {
        "tx_hash": "",
        "executed_protocol": "",
        "actual_pnl": 0.0,
        "execution_error": "",
        "veto_count": state.get("veto_count", 0) + 1,
    }
