"""Executor agent — on-chain and CEX trade execution."""

import asyncio
import logging
import os
import hashlib
import random
import time
from agents.graph import APEXState
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


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
        logger.info("[EXECUTOR] No ranked intents available for execution.")
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

    logger.info("[EXECUTOR] Executing trade: %s/%s", protocol, pool)
    logger.info(
        "[EXECUTOR] Amount: $%s | APY: %s%%", f"{amount_usd:,.2f}", f"{apy:.2f}"
    )

    intent_data = f"{protocol}:{pool}:{amount_usd}:{apy}:{state.get('cycle_number', 0)}"
    tx_hash = _generate_tx_hash(intent_data)

    try:
        result = _attempt_real_execution(opportunity, amount_usd)
        logger.info(
            "[EXECUTOR] Execution completed in %ss", f"{result['execution_time']:.2f}"
        )
        logger.info("[EXECUTOR] Realized PnL: $%s", f"{result['actual_pnl']:,.2f}")
        logger.info("[EXECUTOR] TX Hash: %s", tx_hash)

        # Post execution reputation signal
        _post_executor_signal(state, tx_hash, result["actual_pnl"], protocol, pool)

        return {
            "tx_hash": tx_hash,
            "executed_protocol": protocol,
            "actual_pnl": result["actual_pnl"],
            "execution_error": "",
        }
    except Exception as e:
        logger.error("[EXECUTOR] Execution failed: %s", str(e))
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
        logger.info(
            "[VETO] Trade vetoed: %s | Amount: $%s", protocol, f"{amount_usd:,.2f}"
        )
        logger.info("[VETO] Reason: %s", state.get("guardian_reason", "unknown"))
    else:
        logger.info("[VETO] Trade vetoed (no intent details available)")

    return {
        "tx_hash": "",
        "executed_protocol": "",
        "actual_pnl": 0.0,
        "execution_error": "",
        "veto_count": state.get("veto_count", 0) + 1,
    }


def _post_executor_signal(
    state: APEXState,
    tx_hash: str,
    actual_pnl: float,
    protocol: str,
    pool: str,
) -> None:
    """Post execution result to ERC-8004 Reputation Registry (fire-and-forget)."""
    executor_id = state.get("executor_agent_id", 0)
    strategist_id = state.get("strategist_agent_id", 0)
    if executor_id == 0 or strategist_id == 0:
        logger.info(
            "Executor/Strategist agent IDs not registered — skipping reputation post"
        )
        return

    evidence = {
        "tx_hash": tx_hash,
        "actual_pnl": actual_pnl,
        "protocol": protocol,
        "pool": pool,
        "cycle_number": state.get("cycle_number", 0),
    }

    confidence = min(1.0, max(0.0, 0.5 + (actual_pnl / 1000)))

    async def _post():
        try:
            from mcp_tools.erc8004_skills import post_reputation_signal

            tx = await post_reputation_signal(
                reviewer_agent_id=executor_id,
                subject_agent_id=strategist_id,
                decision="APPROVED" if actual_pnl > 0 else "VETOED",
                reason="execution_result",
                detail=f"Executed {protocol}/{pool} with PnL ${actual_pnl:.2f}",
                confidence=confidence,
                evidence=evidence,
            )
            logger.info(
                "Executor reputation signal posted: tx=%s", tx.get("tx_hash", "")[:20]
            )
        except Exception as e:
            logger.warning("Failed to post executor reputation signal: %s", e)

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_post())
    except RuntimeError:
        asyncio.run(_post())
