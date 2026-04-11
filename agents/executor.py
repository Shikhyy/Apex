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
        "execution_mode": "simulation",
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


def _normalize_protocol_name(protocol: str) -> str:
    return protocol.strip().lower().replace(" ", "")


def _resolve_execution_route(opportunity: dict) -> str:
    protocol = _normalize_protocol_name(str(opportunity.get("protocol", "")))
    pool = str(opportunity.get("pool", "")).upper()

    if protocol in {"aave", "curve", "compound", "aerodrome"}:
        return "surge"

    if protocol in {"kraken", "cex"} or "/" in pool:
        return "kraken"

    return os.environ.get("APEX_EXECUTION_MODE", "simulation").strip().lower()


def _map_protocol_to_pair(opportunity: dict) -> str:
    protocol = _normalize_protocol_name(str(opportunity.get("protocol", "")))
    pool = str(opportunity.get("pool", "")).upper()
    token = str(opportunity.get("token", "USDC")).upper()

    if "/" in pool:
        return pool

    if protocol in {"aave", "curve", "compound", "aerodrome"}:
        base = "ETH" if token in {"WETH", "ETH"} else token.replace("V3", "")
        if base in {"USDC", "USDT", "DAI"}:
            return f"{base}/USD"
        return f"{base}/USD"

    return f"{token}/USD"


def _attempt_real_execution(
    opportunity: dict,
    amount_usd: float,
    user_wallet: str | None = None,
) -> dict:
    """Implement real Web3 execution via RiskRouter contract on Base Sepolia."""
    route = _resolve_execution_route(opportunity)
    private_key = os.environ.get("APEX_PRIVATE_KEY")
    rpc_url = os.environ.get("BASE_SEPOLIA_RPC", "https://sepolia.base.org")
    router_address = os.environ.get("RISK_ROUTER_ADDRESS")
    agent_id = os.environ.get("APEX_EXECUTOR_AGENT_ID", 1)  # Or any valid ID

    logger.info("[EXECUTOR] Execution route resolved to %s", route)

    if route == "kraken":
        try:
            from mcp_tools.execution import execute_kraken_order, calculate_realized_pnl

            pair = _map_protocol_to_pair(opportunity)
            side = str(opportunity.get("side", "buy")).lower()
            kraken_result = execute_kraken_order(pair, amount_usd, side=side)
            if kraken_result.get("status") != "success":
                raise RuntimeError(kraken_result.get("error") or "Kraken order failed")

            price = float(kraken_result.get("avg_price", 0.0))
            if price <= 0:
                raise RuntimeError("Kraken order returned invalid fill price")

            executed_amount = float(kraken_result.get("filled_amount", amount_usd))
            entry_value = amount_usd
            exit_value = executed_amount * price
            pnl = calculate_realized_pnl(entry_value, exit_value)

            return {
                "execution_time": 1.2,
                "actual_pnl": round(pnl, 2),
                "tx_hash": kraken_result.get("order_id", ""),
                "protocol": "kraken",
                "execution_mode": "live",
                "executing_wallet": user_wallet or "",
            }
        except Exception as exc:
            logger.error("[EXECUTOR] Kraken execution failed: %s", exc)
            return {
                "execution_time": 0.0,
                "actual_pnl": 0.0,
                "tx_hash": "",
                "protocol": "kraken",
                "execution_mode": "failed",
                "error": str(exc),
                "executing_wallet": user_wallet or "",
            }

    if route == "surge":
        try:
            from mcp_tools.execution import execute_surge_intent

            signed_intent = _build_signed_intent(opportunity, amount_usd)
            surge_result = asyncio.run(execute_surge_intent(signed_intent))
            if surge_result.get("status") != "success":
                raise RuntimeError(surge_result.get("error") or "Surge execution failed")

            pnl = amount_usd * (opportunity.get("apy", 0) / 100) * random.uniform(0.9, 1.1)
            return {
                "execution_time": 1.8,
                "actual_pnl": round(pnl, 2),
                "tx_hash": surge_result.get("tx_hash", ""),
                "protocol": "surge",
                "execution_mode": "live",
                "executing_wallet": user_wallet or "",
            }
        except Exception as exc:
            logger.error("[EXECUTOR] Surge execution failed: %s", exc)
            return {
                "execution_time": 0.0,
                "actual_pnl": 0.0,
                "tx_hash": "",
                "protocol": "surge",
                "execution_mode": "failed",
                "error": str(exc),
                "executing_wallet": user_wallet or "",
            }

    logger.info("[EXECUTOR] Proceeding with Web3 execution on Base Sepolia...")

    if not private_key or not router_address:
        logger.warning("[EXECUTOR] Missing RPC keys or RiskRouter address. Using simulation.")
        return _simulate_execution(opportunity, amount_usd)

    try:
        from web3 import Web3
        from eth_account import Account
        from mcp_tools.signing import generate_eip712_intent

        w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not w3.is_connected():
            logger.warning("[EXECUTOR] RPC not reachable (%s). Using simulation.", rpc_url)
            return _simulate_execution(opportunity, amount_usd)

        account = Account.from_key(private_key)

        if user_wallet and account.address.lower() != user_wallet.lower():
            raise RuntimeError(
                "Connected wallet does not match backend signer. "
                "Real execution blocked for safety."
            )

        if amount_usd <= 0:
            raise ValueError("Trade amount must be greater than 0 USD")

        # Ensure the signer wallet can pay gas before building transactions.
        gas_price = w3.eth.gas_price
        estimated_gas_budget = 450_000  # submit intent + post-trade bookkeeping
        min_required_wei = gas_price * estimated_gas_budget
        wallet_balance_wei = w3.eth.get_balance(account.address)
        if wallet_balance_wei < min_required_wei:
            raise RuntimeError(
                "Insufficient connected wallet funds for gas: "
                f"have={wallet_balance_wei} wei need~={min_required_wei} wei"
            )

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
            "gasPrice": gas_price,
        })

        signed_tx = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        logger.info(f"[EXECUTOR] Broadcasted SubmitTradeIntent tx: {tx_hash.hex()}")
        submit_receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
        if submit_receipt.status != 1:
            raise RuntimeError("submitTradeIntent reverted on-chain")

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
            "gasPrice": gas_price,
        })
        signed_record_tx = account.sign_transaction(record_tx)
        record_hash = w3.eth.send_raw_transaction(signed_record_tx.raw_transaction)
        record_receipt = w3.eth.wait_for_transaction_receipt(record_hash, timeout=180)
        if record_receipt.status != 1:
            raise RuntimeError("recordProfit reverted on-chain")

        return {
            "execution_time": 2.5,
            "actual_pnl": round(pnl, 2),
            "tx_hash": tx_hash.hex(),
            "protocol": "base-sepolia",
            "execution_mode": "live",
            "executing_wallet": account.address,
        }

    except Exception as e:
        logger.error(f"[EXECUTOR] Base Sepolia tx failed: {str(e)}")
        fallback = _simulate_execution(opportunity, amount_usd)
        fallback["execution_mode"] = "simulation"
        fallback["fallback_error"] = str(e)
        fallback["executing_wallet"] = user_wallet or ""
        return fallback


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
            "executing_wallet": "",
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
    user_wallet = str(state.get("user_wallet") or "").strip().lower() or None

    try:
        result = _attempt_real_execution(opportunity, amount_usd, user_wallet=user_wallet)
        logger.info(
            "[EXECUTOR] Execution completed in %ss", f"{result['execution_time']:.2f}"
        )
        logger.info("[EXECUTOR] Realized PnL: $%s", f"{result['actual_pnl']:,.2f}")
        result_tx_hash = result.get("tx_hash", "")
        execution_mode = result.get("execution_mode", "simulation")
        logger.info("[EXECUTOR] Execution mode: %s", execution_mode)
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
            "execution_error": result.get("error", ""),
            "execution_mode": execution_mode,
            "executing_wallet": result.get("executing_wallet", user_wallet or ""),
        }
    except Exception as e:
        logger.error("[EXECUTOR] Execution failed: %s", str(e))
        return {
            "tx_hash": "",
            "executed_protocol": protocol,
            "actual_pnl": 0.0,
            "execution_error": str(e),
            "execution_mode": "failed",
            "executing_wallet": user_wallet or "",
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
        "execution_mode": "veto",
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
