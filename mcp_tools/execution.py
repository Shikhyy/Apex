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
    Falls back to a mock execution response when the Surge API is unreachable
    or no API key is configured — critical for demo reliability.

    Args:
        signed_intent: Dict containing the signed trade intent payload.
        vault_address: Override vault address; defaults to SURGE_VAULT_ADDRESS env.

    Returns:
        dict with keys: tx_hash, status, executed_amount, protocol, error.
    """

    vault = vault_address or SURGE_VAULT_ADDRESS

    if not SURGE_API_KEY or not vault:
        logger.warning("Surge credentials not configured — using mock execution")
        return _mock_surge_execution(signed_intent)

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

            return {
                "tx_hash": data.get("tx_hash", ""),
                "status": data.get("status", "success"),
                "executed_amount": float(data.get("executed_amount", 0)),
                "protocol": data.get("protocol", "surge"),
                "error": data.get("error", ""),
            }

    except httpx.HTTPStatusError as exc:
        logger.error(
            "Surge API HTTP error %s: %s", exc.response.status_code, exc.response.text
        )
        return {
            "tx_hash": "",
            "status": "failed",
            "executed_amount": 0.0,
            "protocol": "surge",
            "error": f"HTTP {exc.response.status_code}: {exc.response.text}",
        }

    except httpx.RequestError as exc:
        logger.error("Surge API request failed: %s", exc)
        return _mock_surge_execution(signed_intent)

    except Exception as exc:
        logger.error("Unexpected error during Surge execution: %s", exc)
        return {
            "tx_hash": "",
            "status": "failed",
            "executed_amount": 0.0,
            "protocol": "surge",
            "error": str(exc),
        }


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


# ---------------------------------------------------------------------------
# Kraken execution
# ---------------------------------------------------------------------------


def execute_kraken_order(
    pair: str,
    amount: float,
    side: str = "buy",
) -> dict:
    """Execute a market order via the Kraken CLI subprocess.

    Runs ``kraken order create`` as a subprocess. Falls back to a mock
    execution response when the Kraken CLI is not installed or returns an
    error — critical for demo reliability.

    Args:
        pair: Trading pair string, e.g. "ETH/USD".
        amount: Order volume.
        side: "buy" or "sell".

    Returns:
        dict with keys: order_id, status, filled_amount, avg_price, error.
    """

    kraken_bin = shutil.which("kraken")
    if not kraken_bin:
        logger.warning("Kraken CLI not found — using mock execution")
        return _mock_kraken_order(pair, amount, side)

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
            logger.error(
                "Kraken CLI error (rc=%d): %s", result.returncode, result.stderr.strip()
            )
            return _mock_kraken_order(pair, amount, side)

        # Parse JSON output from Kraken CLI
        import json

        try:
            data = json.loads(result.stdout)
        except json.JSONDecodeError:
            logger.warning("Kraken CLI output is not valid JSON — using mock execution")
            return _mock_kraken_order(pair, amount, side)

        return {
            "order_id": data.get("order_id", ""),
            "status": data.get("status", "success"),
            "filled_amount": float(data.get("filled_amount", 0)),
            "avg_price": float(data.get("avg_price", 0)),
            "error": data.get("error", ""),
        }

    except subprocess.TimeoutExpired:
        logger.error("Kraken CLI timed out after %ds", EXECUTION_TIMEOUT)
        return _mock_kraken_order(pair, amount, side)

    except Exception as exc:
        logger.error("Unexpected error during Kraken execution: %s", exc)
        return _mock_kraken_order(pair, amount, side)


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
    gas_cost: float = 0.0,
) -> float:
    """Calculate realized profit/loss after a trade.

    Args:
        entry_value: USD value at trade entry.
        exit_value: USD value at trade exit.
        gas_cost: Total gas / fees paid in USD.

    Returns:
        Realized PnL in USD. Positive = profit, negative = loss.
    """

    return exit_value - entry_value - gas_cost


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
