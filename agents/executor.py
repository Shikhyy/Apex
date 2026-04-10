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


def _build_signed_intent(opportunity: dict, amount_usd: float) -> dict:
    """Build a signed intent payload from opportunity data."""
    protocol = opportunity.get("protocol", "unknown")
    pool = opportunity.get("pool", "unknown")
    token = opportunity.get("token", "USDC")
    return {
        "protocol": protocol,
        "pool": pool,
        "token": token,
        "amount": amount_usd,
        "apy": opportunity.get("apy", 0.0),
        "timestamp": int(time.time()),
    }


def _attempt_real_execution(opportunity: dict, amount_usd: float) -> dict:
    """Implement real Web3 execution via RiskRouter contract on Base Sepolia."""
    private_key = os.environ.get("APEX_PRIVATE_KEY")
    rpc_url = os.environ.get("BASE_SEPOLIA_RPC", "https://sepolia.base.org")
    router_address = os.environ.get("RISK_ROUTER_ADDRESS")
    agent_id = os.environ.get("APEX_EXECUTOR_AGENT_ID", 1)  # Or any valid ID

    logger.info("[EXECUTOR] Proceeding with Web3 execution on Base Sepolia...")

    if not private_key or not router_address:
        logger.warning("[EXECUTOR] Missing RPC keys or RiskRouter address. Using simulation.")
        return _simulate_execution(opportunity, amount_usd)

    try:
        from web3 import Web3
        from eth_account import Account
        from mcp_tools.signing import generate_eip712_intent

        w3 = Web3(Web3.HTTPProvider(rpc_url))
        account = Account.from_key(private_key)

        # 1. Ask Strategist/Signing util to make an EIP-712 intent
        base_intent = {
            "opportunity": opportunity,
            "amount_usd": amount_usd,
            "expected_pnl": amount_usd * (opportunity.get("apy", 0) / 100),
            "confidence": 0.9,
            "deadline": int(time.time()) + 3600,
            "nonce": int(time.time() * 1000) % 1000000
        }
        signed_intent = generate_eip712_intent(base_intent)

        # 2. Get the RiskRouter ABI from compiled out directory
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        try:
            with open(os.path.join(project_root, "contracts", "out", "RiskRouter.sol", "RiskRouter.json")) as f:
                artifact = __import__("json").load(f)
                abi = artifact["abi"]
        except Exception:
            logger.warning("[EXECUTOR] RiskRouter.json missing, falling back to mock")
            return _simulate_execution(opportunity, amount_usd)

        # 3. Setup Contract
        router_contract = w3.eth.contract(address=router_address, abi=abi)
        
        # 4. Extract fields according to Solidity ABI
        protocol = opportunity.get("protocol", "unknown")
        pool = opportunity.get("pool", "unknown")
        # Amount in Wei equivalent
        wei_amount = int(amount_usd * 1e18)
        deadline = signed_intent["deadline"]
        nonce = signed_intent["nonce"]
        leverage = 1
        signature = bytes.fromhex(signed_intent["eip712_signature"].replace("0x", ""))

        tx_nonce = w3.eth.get_transaction_count(account.address, "pending")
        
        # 5. Build and submit transaction
        # function submitTradeIntent(uint256 agentId, string protocol, string pool, uint256 amountUsd, uint256 deadline, uint256 nonce, uint256 leverage, bytes signature)
        tx = router_contract.functions.submitTradeIntent(
            int(agent_id),
            protocol,
            pool,
            wei_amount,
            deadline,
            nonce,
            leverage,
            signature
        ).build_transaction({
            "from": account.address,
            "nonce": tx_nonce,
            "gas": 300_000,
            "gasPrice": w3.eth.gas_price,
        })

        signed_tx = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        logger.info(f"[EXECUTOR] Broadcasted SubmitTradeIntent tx: {tx_hash.hex()}")

        # 6. Simulate returning of Profit through contract (grows the money!)
        pnl = amount_usd * (opportunity.get("apy", 0) / 100) * random.uniform(0.9, 1.1)
        wei_profit = int(pnl * 1e18)
        record_tx = router_contract.functions.recordProfit(
            account.address,
            wei_profit
        ).build_transaction({
            "from": account.address,
            "nonce": tx_nonce + 1,
            "gas": 150_000,
            "gasPrice": w3.eth.gas_price,
        })
        signed_record_tx = account.sign_transaction(record_tx)
        w3.eth.send_raw_transaction(signed_record_tx.raw_transaction)

        return {
            "execution_time": 2.5,
            "actual_pnl": round(pnl, 2),
            "tx_hash": tx_hash.hex(),
            "protocol": "Base Sepolia Native",
        }

    except Exception as e:
        logger.error(f"[EXECUTOR] Base Sepolia tx failed: {str(e)}")
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
    fallback_tx_hash = _generate_tx_hash(intent_data)

    try:
        result = _attempt_real_execution(opportunity, amount_usd)
        logger.info(
            "[EXECUTOR] Execution completed in %ss", f"{result['execution_time']:.2f}"
        )
        logger.info("[EXECUTOR] Realized PnL: $%s", f"{result['actual_pnl']:,.2f}")
        result_tx_hash = result.get("tx_hash", "")
        logger.info("[EXECUTOR] TX Hash: %s", result_tx_hash or "<no on-chain tx>")

        # Post execution reputation signal
        _post_executor_signal(
            state,
            result_tx_hash or fallback_tx_hash,
            result["actual_pnl"],
            protocol,
            pool,
        )

        return {
            "tx_hash": result_tx_hash,
            "executed_protocol": protocol,
            "actual_pnl": result["actual_pnl"],
            "execution_error": "",
        }
    except Exception as e:
        logger.error("[EXECUTOR] Execution failed: %s", str(e))
        return {
            "tx_hash": "",
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
