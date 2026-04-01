"""EIP-712 trade intent signing and position sizing utilities."""

import hashlib
import logging
import os
from typing import Optional

from eth_account import Account
from eth_account.messages import encode_typed_data

logger = logging.getLogger(__name__)

EIP712_DOMAIN = {
    "name": "APEX",
    "version": "1",
    "chainId": 84532,
    "verifyingContract": "0x0000000000000000000000000000000000000000",
}

EIP712_TYPES = {
    "TradeIntent": [
        {"name": "protocol", "type": "string"},
        {"name": "pool", "type": "string"},
        {"name": "amount_usd", "type": "uint256"},
        {"name": "deadline", "type": "uint256"},
        {"name": "nonce", "type": "uint256"},
    ]
}

MAX_POSITION_PCT = 0.20
MIN_POSITION_USD = 100.0


def _get_signer() -> Optional[Account]:
    """Load signing account from APEX_PRIVATE_KEY env var.

    Returns an eth_account.Account if the key is set, otherwise None
    so callers can fall back to mock signing.
    """
    private_key = os.environ.get("APEX_PRIVATE_KEY")
    if not private_key:
        logger.warning("APEX_PRIVATE_KEY not set — using mock signing")
        return None
    return Account.from_key(private_key)


def _generate_intent_hash(trade_intent: dict) -> str:
    """Generate a keccak256 hash of the trade intent for on-chain verification.

    The hash covers the core fields that the Surge Risk Router will verify.
    """
    payload = (
        f"{trade_intent['opportunity']['protocol']}"
        f"{trade_intent['opportunity']['pool']}"
        f"{trade_intent['amount_usd']}"
        f"{trade_intent['expected_pnl']}"
        f"{trade_intent['confidence']}"
    ).encode()
    return "0x" + hashlib.sha3_256(payload).hexdigest()


def generate_eip712_intent(trade_intent: dict) -> dict:
    """Sign a TradeIntent using EIP-712 typed data.

    Builds the EIP-712 domain + types, encodes the message, and signs it
    with the account derived from APEX_PRIVATE_KEY.  If no key is set a
    mock signature is returned so development can continue without a wallet.

    Args:
        trade_intent: dict with keys matching the TradeIntent TypedDict
                      (opportunity, amount_usd, expected_pnl, confidence).

    Returns:
        The original trade_intent dict augmented with ``eip712_signature``
        and ``intent_hash`` fields.
    """
    intent_hash = _generate_intent_hash(trade_intent)

    opp = trade_intent["opportunity"]
    amount_usd_int = int(trade_intent["amount_usd"] * 1e18)  # scale to wei-like units

    message = {
        "protocol": opp["protocol"],
        "pool": opp["pool"],
        "amount_usd": amount_usd_int,
        "deadline": trade_intent.get("deadline", 0) or 0,
        "nonce": trade_intent.get("nonce", 0) or 0,
    }

    signer = _get_signer()

    if signer is not None:
        signable = encode_typed_data(
            domain_data=EIP712_DOMAIN,
            message_types=EIP712_TYPES,
            message_data=message,
        )
        signed = signer.sign_message(signable)
        signature = signed.signature.hex()
    else:
        # Mock signature for development (65 zero-bytes + recovery id 27)
        signature = "0x" + "00" * 65

    trade_intent["eip712_signature"] = signature
    trade_intent["intent_hash"] = intent_hash
    return trade_intent


def calculate_position_size(
    opportunity: dict,
    vault_balance: float,
    volatility_index: float,
) -> float:
    """Calculate optimal position size using Kelly criterion with a hard cap.

    The Kelly fraction is ``f* = (bp - q) / b`` where:
    - ``p`` is the win probability (taken from opportunity['confidence'])
    - ``q = 1 - p``
    - ``b`` is the odds ratio (taken from opportunity['apy'] / 100)

    The raw Kelly size is then scaled down by ``volatility_index / 100``
    (higher volatility → smaller position) and capped at 20 % of the vault
    balance.  A floor of $100 is enforced.

    Args:
        opportunity: dict with at least ``confidence`` (0-1) and ``apy`` (percent).
        vault_balance: total vault balance in USD.
        volatility_index: current market volatility (0-100+).

    Returns:
        Optimal position size in USD.
    """
    confidence = opportunity.get("confidence", 0.5)
    apy = opportunity.get("apy", 0.0)

    # Kelly criterion
    p = max(0.0, min(1.0, confidence))
    q = 1.0 - p
    b = max(apy / 100.0, 1.0)  # floor at even odds for practical yield sizing

    kelly_fraction = (b * p - q) / b
    kelly_fraction = max(0.0, kelly_fraction)  # never negative

    # Scale by volatility (higher vol → smaller position) and apply hard cap
    vol_scale = max(volatility_index / 100.0, 0.01)
    raw_size = kelly_fraction * vault_balance / vol_scale
    capped_size = min(raw_size, MAX_POSITION_PCT * vault_balance)

    return max(capped_size, MIN_POSITION_USD)
