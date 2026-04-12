"""Trade execution tools — Surge Risk Router and Kraken CEX."""

import logging
import os
import shutil
import subprocess
from typing import Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

SURGE_API_KEY = os.getenv("SURGE_API_KEY", "")
SURGE_VAULT_ADDRESS = os.getenv("SURGE_VAULT_ADDRESS", "")
KRAKEN_API_KEY = os.getenv("KRAKEN_API_KEY", "")
KRAKEN_API_SECRET = os.getenv("KRAKEN_API_SECRET", "")

SURGE_API_BASE = "https://api.surge.trade"  # sandbox URL; override via env if needed
EXECUTION_TIMEOUT = 30  # seconds

# ---------------------------------------------------------------------------
# Surge execution
# ---------------------------------------------------------------------------


async def execute_surge_intent(
    signed_intent: dict,
    vault_address: Optional[str] = None,
) -> dict:
    """Execute a signed trade intent through the Surge Risk Router.

    Sends the signed intent to the Surge sandbox API for on-chain execution.
    Fails hard if credentials missing or API unreachable (no silent mocks).

    Args:
        signed_intent: Dict containing the signed trade intent payload.
        vault_address: Override vault address; defaults to SURGE_VAULT_ADDRESS env.

    Returns:
        dict with keys: tx_hash, status, executed_amount, protocol, error.
        
    Raises:
        RuntimeError: If credentials missing or API request fails.
    """

    vault = vault_address or SURGE_VAULT_ADDRESS

    if not SURGE_API_KEY or not vault:
        raise RuntimeError(
            "Surge credentials not configured. "
            "Set SURGE_API_KEY and SURGE_VAULT_ADDRESS in .env"
        )

    payload = {
        "vault_address": vault,
        "intent": signed_intent,
    }

    try:
        async with httpx.AsyncClient(timeout=EXECUTION_TIMEOUT) as client:
            response = await client.post(
                f"{SURGE_API_BASE}/v1/execute",
                json=payload,
                headers={"Authorization": f"Bearer {SURGE_API_KEY}"},
            )
            response.raise_for_status()
            data = response.json()

            if data.get("status") == "failed":
                raise RuntimeError(f"Surge execution failed: {data.get('error', 'unknown')}")

            # Validate required fields
            if not data.get("tx_hash"):
                raise RuntimeError(f"Surge returned no tx_hash: {data}")

            return {
                "tx_hash": data.get("tx_hash", ""),
                "status": data.get("status", "success"),
                "executed_amount": float(data.get("executed_amount", 0)),
                "protocol": data.get("protocol", "surge"),
                "error": data.get("error", ""),
            }

    except httpx.HTTPStatusError as exc:
        error_text = exc.response.text
        logger.error("Surge API HTTP error %s: %s", exc.response.status_code, error_text)
        raise RuntimeError(f"Surge API error {exc.response.status_code}: {error_text}")

    except httpx.RequestError as exc:
        logger.error("Surge API request failed: %s", exc)
        raise RuntimeError(f"Surge API unreachable: {str(exc)}")

    except RuntimeError:
        raise

    except Exception as exc:
        logger.error("Unexpected error during Surge execution: %s", exc)
        raise RuntimeError(f"Surge execution failed: {str(exc)}")


def _mock_surge_execution(signed_intent: dict) -> dict:
    """Return a realistic mock Surge execution response for demo/sandbox."""

    amount = float(signed_intent.get("amount", 0))
    token = signed_intent.get("token", "USDC")
    mock_hash = "0xmock" + token[:4].lower() + hex(int(amount * 100))[2:].zfill(8)

    logger.info(
        "Mock Surge execution: amount=%s token=%s hash=%s", amount, token, mock_hash
    )

    return {
        "tx_hash": mock_hash,
        "status": "success",
        "executed_amount": amount,
        "protocol": "surge",
        "error": "",
    }


def extract_surge_gas_cost(tx_hash: str, rpc_url: Optional[str] = None) -> float:
    """Extract gas cost in USD from a Surge transaction via RPC.
    
    Fetches the transaction receipt and calculates:
    gas_used * gasPrice / 1e18 (to get ETH) * ETH/USD price
    
    Args:
        tx_hash: Transaction hash to lookup (0x-prefixed)
        rpc_url: RPC endpoint URL; defaults to BASE_SEPOLIA_RPC env
        
    Returns:
        Gas cost in USD. Returns 0.0 if tx not found or RPC fails.
    """
    if not tx_hash:
        return 0.0
    
    rpc = rpc_url or os.environ.get("BASE_SEPOLIA_RPC", "https://sepolia.base.org")
    eth_usd_price = float(os.environ.get("ETH_USD_PRICE", "3500"))  # Fallback price
    
    try:
        import httpx
        
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "eth_getTransactionReceipt",
            "params": [tx_hash],
        }
        
        with httpx.Client(timeout=10.0) as client:
            response = client.post(rpc, json=payload)
            response.raise_for_status()
            data = response.json()
        
        result = data.get("result")
        if not result:
            logger.warning(f"Transaction {tx_hash} not found")
            return 0.0
        
        gas_used = int(result.get("gasUsed", "0"), 0)
        gas_price = int(result.get("gasPrice", "0"), 0)
        
        if gas_used == 0 or gas_price == 0:
            return 0.0
        
        # Convert to ETH: gas_used * gasPrice / 10^18
        gas_eth = (gas_used * gas_price) / (10 ** 18)
        
        # Convert to USD
        gas_usd = gas_eth * eth_usd_price
        
        logger.info(f"Gas cost for {tx_hash}: {gas_eth:.6f} ETH = ${gas_usd:.2f}")
        return round(gas_usd, 2)
        
    except Exception as e:
        logger.warning(f"Failed to extract gas cost for {tx_hash}: {e}")
        return 0.0


# ---------------------------------------------------------------------------
# Kraken execution
# ---------------------------------------------------------------------------


def execute_kraken_order(
    pair: str,
    amount: float,
    side: str = "buy",
) -> dict:
    """Execute a market order via the Kraken CLI subprocess.

    Runs ``kraken order create`` as a subprocess. Fails hard on any error
    to ensure only real trades are recorded.

    Args:
        pair: Trading pair string, e.g. "ETH/USD".
        amount: Order volume.
        side: "buy" or "sell".

    Returns:
        dict with keys: order_id, status, filled_amount, avg_price, error.
        
    Raises:
        RuntimeError: If Kraken CLI not found or trade fails (no silent mocks).
    """

    kraken_bin = shutil.which("kraken")
    if not kraken_bin:
        raise RuntimeError(
            "Kraken CLI not found. Install with: cargo install kraken-cli\n"
            "Or set APEX_KRAKEN_CLI_PATH environment variable."
        )

    cmd = [
        kraken_bin,
        "order",
        "create",
        "--pair",
        pair,
        "--side",
        side,
        "--volume",
        str(amount),
        "--type",
        "market",
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=EXECUTION_TIMEOUT,
        )

        if result.returncode != 0:
            error_msg = result.stderr.strip()
            logger.error("Kraken CLI error (rc=%d): %s", result.returncode, error_msg)
            raise RuntimeError(f"Kraken order failed: {error_msg}")

        # Parse JSON output from Kraken CLI
        import json

        try:
            data = json.loads(result.stdout)
        except json.JSONDecodeError as e:
            logger.error("Kraken CLI output is not valid JSON: %s", result.stdout)
            raise RuntimeError(f"Kraken CLI returned invalid JSON: {str(e)}")

        # Validate required fields
        if not data.get("order_id"):
            raise RuntimeError(f"Kraken order missing order_id: {data}")

        return {
            "order_id": data.get("order_id", ""),
            "status": data.get("status", "success"),
            "filled_amount": float(data.get("filled_amount", 0)),
            "avg_price": float(data.get("avg_price", 0)),
            "error": data.get("error", ""),
        }

    except subprocess.TimeoutExpired:
        raise RuntimeError(f"Kraken CLI timed out after {EXECUTION_TIMEOUT}s")

    except RuntimeError:
        raise

    except Exception as exc:
        raise RuntimeError(f"Kraken execution failed: {str(exc)}")


def _mock_kraken_order(pair: str, amount: float, side: str) -> dict:
    """Return a realistic mock Kraken order response for demo/sandbox."""

    import hashlib
    import time

    seed = f"{pair}{side}{amount}{time.time()}"
    short_id = hashlib.md5(seed.encode()).hexdigest()[:12]

    # Simulate a plausible price based on pair
    base = pair.split("/")[0] if "/" in pair else pair
    mock_prices = {
        "ETH": 3500.0,
        "BTC": 95000.0,
        "SOL": 180.0,
        "USDC": 1.0,
        "USDT": 1.0,
    }
    price = mock_prices.get(base.upper(), 2000.0)

    logger.info(
        "Mock Kraken order: pair=%s side=%s amount=%s price=%s",
        pair,
        side,
        amount,
        price,
    )

    return {
        "order_id": f"MOCK-{short_id.upper()}",
        "status": "success",
        "filled_amount": amount,
        "avg_price": price,
        "error": "",
    }


# ---------------------------------------------------------------------------
# PnL calculation
# ---------------------------------------------------------------------------


def calculate_realized_pnl(
    entry_value: float,
    exit_value: float,
    kraken_fee_pct: float = 0.26,
    gas_cost_usd: float = 0.0,
) -> float:
    """Calculate realized profit/loss after a trade.

    Accounts for Kraken exchange fees (0.26% taker, 0.16% maker default).
    Gas costs are subtracted for on-chain trades.

    Args:
        entry_value: USD value at trade entry.
        exit_value: USD value at trade exit.
        kraken_fee_pct: Fee percentage (default 0.26% taker). Use 0.16 for maker.
        gas_cost_usd: Total gas / fees paid in USD.

    Returns:
        Realized PnL in USD. Positive = profit, negative = loss.
    """

    # Calculate gross PnL
    gross_pnl = exit_value - entry_value

    # Deduct Kraken fees from the transaction size (not profit)
    kraken_fee = abs(exit_value) * (kraken_fee_pct / 100)

    # Final net PnL after all fees and gas
    return round(gross_pnl - kraken_fee - gas_cost_usd, 2)


# ---------------------------------------------------------------------------
# Kraken Paper Trading
# ---------------------------------------------------------------------------

_paper_portfolio: dict = {}


def kraken_paper_init(balance_usd: float = 100_000.0) -> dict:
    """Initialize a paper trading portfolio."""
    global _paper_portfolio
    _paper_portfolio = {
        "usd": balance_usd,
        "positions": {},
        "trades": [],
    }
    logger.info("Paper trading initialized with $%s", f"{balance_usd:,.2f}")
    return {"status": "initialized", "balance_usd": balance_usd}


def kraken_paper_buy(pair: str, amount_usd: float, price: float) -> dict:
    """Execute a paper buy order."""
    if not _paper_portfolio:
        kraken_paper_init()
    if _paper_portfolio["usd"] < amount_usd:
        return {"status": "failed", "error": "Insufficient USD balance"}
    quantity = amount_usd / price
    _paper_portfolio["usd"] -= amount_usd
    _paper_portfolio["positions"][pair] = (
        _paper_portfolio["positions"].get(pair, 0) + quantity
    )
    trade = {
        "side": "buy",
        "pair": pair,
        "amount_usd": amount_usd,
        "price": price,
        "quantity": quantity,
    }
    _paper_portfolio["trades"].append(trade)
    return {"status": "success", "quantity": round(quantity, 6), "price": price}


def kraken_paper_sell(pair: str, quantity: float, price: float) -> dict:
    """Execute a paper sell order."""
    if not _paper_portfolio:
        kraken_paper_init()
    held = _paper_portfolio["positions"].get(pair, 0)
    if held < quantity:
        return {"status": "failed", "error": f"Insufficient {pair} balance"}
    amount_usd = quantity * price
    _paper_portfolio["positions"][pair] = held - quantity
    _paper_portfolio["usd"] += amount_usd
    trade = {
        "side": "sell",
        "pair": pair,
        "quantity": quantity,
        "price": price,
        "amount_usd": amount_usd,
    }
    _paper_portfolio["trades"].append(trade)
    return {"status": "success", "amount_usd": round(amount_usd, 2), "price": price}


def kraken_paper_status() -> dict:
    """Return current paper portfolio status."""
    if not _paper_portfolio:
        return {"status": "not_initialized"}
    return {
        "usd_balance": round(_paper_portfolio["usd"], 2),
        "positions": {k: round(v, 6) for k, v in _paper_portfolio["positions"].items()},
        "trade_count": len(_paper_portfolio["trades"]),
    }


def kraken_fetch_ticker(pair: str) -> dict:
    """Fetch a mock ticker price for a trading pair."""
    mock_prices = {
        "ETH/USD": 3500.0,
        "BTC/USD": 95000.0,
        "SOL/USD": 180.0,
        "USDC/USD": 1.0,
        "AERO/USD": 1.42,
    }
    price = mock_prices.get(pair, 2000.0)
    return {"pair": pair, "price": price, "volume_24h": 1_000_000.0}
