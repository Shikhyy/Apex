"""Risk analysis tools for the APEX Guardian agent.

Provides functions for:
- Projected drawdown calculation based on pool characteristics
- On-chain agent reputation queries via ERC-8004 Reputation Registry
- Protocol audit status lookups

These tools are consumed by the Guardian agent to evaluate trade intents
and make veto decisions before execution.
"""

import logging
import os
from typing import Optional

from web3 import Web3

logger = logging.getLogger(__name__)

# --- Constants ---

BASE_SEPOLIA_RPC = "https://sepolia.base.org"
DEFAULT_REGISTRY_ADDRESS = "0xec6A0E1aB27882E222200F89D17f76eD8413c926"


def _rpc_url() -> str:
    return os.environ.get("BASE_SEPOLIA_RPC", BASE_SEPOLIA_RPC)


def _registry_address() -> str:
    return os.environ.get("REPUTATION_REGISTRY_ADDRESS", DEFAULT_REGISTRY_ADDRESS)

REGISTRY_ABI = [
    {
        "anonymous": False,
        "inputs": [
            {
                "indexed": True,
                "internalType": "uint256",
                "name": "agentId",
                "type": "uint256",
            },
            {
                "indexed": True,
                "internalType": "address",
                "name": "clientAddress",
                "type": "address",
            },
            {
                "indexed": False,
                "internalType": "uint64",
                "name": "feedbackIndex",
                "type": "uint64",
            },
            {
                "indexed": False,
                "internalType": "int128",
                "name": "value",
                "type": "int128",
            },
            {
                "indexed": False,
                "internalType": "uint8",
                "name": "valueDecimals",
                "type": "uint8",
            },
            {
                "indexed": True,
                "internalType": "string",
                "name": "indexedTag1",
                "type": "string",
            },
            {
                "indexed": False,
                "internalType": "string",
                "name": "tag1",
                "type": "string",
            },
            {
                "indexed": False,
                "internalType": "string",
                "name": "tag2",
                "type": "string",
            },
            {
                "indexed": False,
                "internalType": "string",
                "name": "endpoint",
                "type": "string",
            },
            {
                "indexed": False,
                "internalType": "string",
                "name": "feedbackURI",
                "type": "string",
            },
            {
                "indexed": False,
                "internalType": "bytes32",
                "name": "feedbackHash",
                "type": "bytes32",
            },
        ],
        "name": "FeedbackSubmitted",
        "type": "event",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "agentId", "type": "uint256"},
            {"internalType": "address", "name": "clientAddress", "type": "address"},
            {"internalType": "uint64", "name": "feedbackIndex", "type": "uint64"},
        ],
        "name": "readFeedback",
        "outputs": [
            {"internalType": "int128", "name": "value", "type": "int128"},
            {"internalType": "uint8", "name": "valueDecimals", "type": "uint8"},
            {"internalType": "string", "name": "tag1", "type": "string"},
            {"internalType": "string", "name": "tag2", "type": "string"},
            {"internalType": "bool", "name": "isRevoked", "type": "bool"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "agentId", "type": "uint256"},
            {
                "internalType": "address[]",
                "name": "clientAddresses",
                "type": "address[]",
            },
            {"internalType": "string", "name": "tag1", "type": "string"},
            {"internalType": "string", "name": "tag2", "type": "string"},
        ],
        "name": "getSummary",
        "outputs": [
            {"internalType": "uint64", "name": "count", "type": "uint64"},
            {"internalType": "int128", "name": "summaryValue", "type": "int128"},
            {"internalType": "uint8", "name": "summaryValueDecimals", "type": "uint8"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "uint256", "name": "agentId", "type": "uint256"}],
        "name": "getClients",
        "outputs": [{"internalType": "address[]", "name": "", "type": "address[]"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "", "type": "uint256"},
            {"internalType": "address", "name": "", "type": "address"},
        ],
        "name": "feedbackCount",
        "outputs": [{"internalType": "uint64", "name": "", "type": "uint64"}],
        "stateMutability": "view",
        "type": "function",
    },
]

# Known protocol audit status lookup
KNOWN_PROTOCOLS = {
    "aave": {
        "is_audited": True,
        "auditor": "Trail of Bits, OpenZeppelin, PeckShield",
        "audit_date": "2024-01-15",
        "audit_url": "https://docs.aave.com/developers/security-and-audits",
    },
    "curve": {
        "is_audited": True,
        "auditor": "Trail of Bits, MixBytes, ChainSecurity",
        "audit_date": "2023-11-20",
        "audit_url": "https://curve.readthedocs.io/security.html",
    },
    "compound": {
        "is_audited": True,
        "auditor": "OpenZeppelin, Trail of Bits, Certora",
        "audit_date": "2024-02-10",
        "audit_url": "https://compound.finance/docs/security",
    },
    "uniswap": {
        "is_audited": True,
        "auditor": "ABDK, Trail of Bits, OpenZeppelin",
        "audit_date": "2023-09-01",
        "audit_url": "https://docs.uniswap.org/contracts/v3/reference/core/UniswapV3Pool",
    },
    "lido": {
        "is_audited": True,
        "auditor": "Quantstamp, MixBytes, Sigma Prime",
        "audit_date": "2024-03-05",
        "audit_url": "https://github.com/lidofinance/audits",
    },
    "makerdao": {
        "is_audited": True,
        "auditor": "Trail of Bits, Runtime Verification, PeckShield",
        "audit_date": "2023-12-18",
        "audit_url": "https://security.makerdao.com/",
    },
    "yearn": {
        "is_audited": True,
        "auditor": "MixBytes, ChainSecurity, Trail of Bits",
        "audit_date": "2024-01-25",
        "audit_url": "https://docs.yearn.fi/developers/security",
    },
    "convex": {
        "is_audited": True,
        "auditor": "MixBytes",
        "audit_date": "2023-08-14",
        "audit_url": "https://docs.convexfinance.com/convexfinance/general-information",
    },
}


def calculate_projected_drawdown(opportunity: dict, volatility_index: float) -> float:
    """Calculate the projected maximum drawdown for a yield opportunity.

    Uses a simple but defensible model that combines multiple risk factors:

    - **Volatility component**: Higher volatility index (0-100) directly
      correlates with larger potential drawdowns. Scaled linearly with
      a 0.06x multiplier so that vol=100 yields ~6% base drawdown.
    - **TVL component**: Lower TVL means higher slippage and exit risk.
      Pools under $1M TVL get a significant penalty (up to 3% extra).
    - **APY component**: Higher APY often correlates with higher risk
      strategies (leverage, impermanent loss exposure). Adds up to 2%
      for APYs above 20%.
    - **Liquidity component**: Lower liquidity relative to TVL increases
      the cost of exiting a position.

    The model caps total projected drawdown at 25% to reflect that even
    in extreme scenarios, yield pool drawdowns rarely exceed this.

    Args:
        opportunity: Dict with keys:
            - apy (float): Annual percentage yield
            - tvl_usd (float): Total value locked in USD
            - liquidity_usd (float): Available liquidity in USD
        volatility_index: Market volatility index (0-100 scale)

    Returns:
        Projected maximum drawdown as a percentage (e.g., 3.5 means 3.5%).
    """
    apy = opportunity.get("apy", 0.0)
    tvl_usd = opportunity.get("tvl_usd", 1_000_000)
    liquidity_usd = opportunity.get("liquidity_usd", tvl_usd)

    # Volatility component: linear scaling, vol=100 -> 6% base
    vol_component = (volatility_index / 100.0) * 6.0

    # TVL component: inverse relationship, smaller pools = higher risk
    # $100K TVL -> 3% penalty, $10M+ TVL -> 0% penalty
    if tvl_usd < 10_000_000:
        tvl_factor = max(0.0, 1.0 - (tvl_usd / 10_000_000))
        tvl_component = tvl_factor * 3.0
    else:
        tvl_component = 0.0

    # APY component: higher APY = higher risk
    # APY > 20% starts adding risk, caps at 2% extra for APY >= 100%
    if apy > 20.0:
        apy_component = min(2.0, (apy - 20.0) / 80.0 * 2.0)
    else:
        apy_component = 0.0

    # Liquidity ratio component: low liquidity/TVL ratio increases exit risk
    liquidity_ratio = liquidity_usd / max(tvl_usd, 1)
    if liquidity_ratio < 0.5:
        liq_component = (0.5 - liquidity_ratio) * 2.0
    else:
        liq_component = 0.0

    drawdown = vol_component + tvl_component + apy_component + liq_component

    # Cap at 25% — even extreme events rarely exceed this for yield pools
    return round(min(drawdown, 25.0), 2)


def fetch_agent_reputation(
    agent_id: int,
    registry_address: Optional[str] = None,
) -> dict:
    """Fetch on-chain reputation for an agent from the ERC-8004 Reputation Registry.

    Connects to Base Sepolia via public RPC and reads historical FeedbackSubmitted
    events for the given subject agent ID. Calculates the average score across
    all feedback entries and normalizes it to a 0.0-1.0 scale.

    The ERC-8004 score range is -100 to +100. Normalization maps:
        -100 -> 0.0 (worst reputation)
           0 -> 0.5 (neutral)
        +100 -> 1.0 (best reputation)

    If the RPC connection fails or no events are found, returns a default
    neutral reputation (0.5 normalized, 0 entries).

    Args:
        agent_id: The on-chain agent identifier to look up.
        registry_address: Contract address of the Reputation Registry.
            Defaults to the Base Sepolia deployment.

    Returns:
        Dict with keys:
            - agent_id (int): The queried agent ID
            - avg_score (float): Average feedback score (-100 to +100)
            - normalized (float): Score mapped to 0.0-1.0 range
            - count (int): Number of feedback entries found
    """
    if registry_address is None:
        registry_address = _registry_address()

    error_result = {
        "agent_id": agent_id,
        "avg_score": None,
        "normalized": None,
        "count": 0,
        "error": "reputation_unavailable",
    }

    try:
        w3 = Web3(Web3.HTTPProvider(_rpc_url(), request_kwargs={"timeout": 10}))

        if not w3.is_connected():
            logger.warning(
                "Could not connect to Base Sepolia RPC at %s",
                _rpc_url(),
            )
            return error_result

        registry = w3.eth.contract(
            address=Web3.to_checksum_address(registry_address),
            abi=REGISTRY_ABI,
        )

        # Filter events where this agent was the subject of feedback
        event_filter = registry.events.FeedbackSubmitted.create_filter(
            from_block=0,
            argument_filters={"agentId": agent_id},
        )

        events = event_filter.get_all_entries()

        if not events:
            logger.info("No feedback events found for agent_id=%d", agent_id)
            return {
                "agent_id": agent_id,
                "avg_score": 0.0,
                "normalized": 0.5,
                "count": 0,
                "error": "",
            }

        scores = []
        for event in events:
            score = event["args"]["value"]
            decimals = event["args"]["valueDecimals"]
            if decimals > 0:
                score = score / (10**decimals)
            scores.append(score)

        avg_score = sum(scores) / len(scores)
        # Normalize from [-100, +100] to [0.0, 1.0]
        normalized = (avg_score + 100) / 200.0

        return {
            "agent_id": agent_id,
            "avg_score": round(avg_score, 2),
            "normalized": round(normalized, 4),
            "count": len(scores),
            "error": "",
        }

    except Exception as e:
        logger.error(
            "Failed to fetch reputation for agent_id=%d: %s",
            agent_id,
            e,
        )
        return error_result


def check_protocol_audit_status(protocol: str) -> dict:
    """Check if a DeFi protocol has been audited.

    Looks up the protocol name in a curated table of known protocols with
    verified audit information. This is used by the Guardian agent as one
    factor in assessing protocol risk.

    For protocols not in the lookup table, returns is_audited=False with
    a note that the protocol is unrecognized. This is a conservative default
    — an unknown protocol should be treated as unaudited until verified.

    Protocol names are matched case-insensitively.

    Args:
        protocol: Protocol name (e.g., "aave", "curve", "compound").

    Returns:
        Dict with keys:
            - protocol (str): The queried protocol name
            - is_audited (bool): Whether the protocol has known audits
            - auditor (str): Name(s) of the auditing firm(s)
            - audit_date (str): Date of the most recent audit (YYYY-MM-DD)
            - audit_url (str): URL to audit documentation
    """
    protocol_key = protocol.lower().strip()

    if protocol_key in KNOWN_PROTOCOLS:
        info = KNOWN_PROTOCOLS[protocol_key]
        return {
            "protocol": protocol_key,
            "is_audited": info["is_audited"],
            "auditor": info["auditor"],
            "audit_date": info["audit_date"],
            "audit_url": info["audit_url"],
        }

    return {
        "protocol": protocol_key,
        "is_audited": False,
        "auditor": "unknown",
        "audit_date": "",
        "audit_url": "",
    }


def fetch_reputation_signals(
    agent_id: int,
    registry_address: Optional[str] = None,
) -> list[dict]:
    """Fetch individual reputation signals (FeedbackSubmitted events) for an agent.

    Returns a list of signal dicts, each with:
    - agent_id (int)
    - client_address (str)
    - feedback_index (int)
    - value (int)
    - tag1 (str)
    - feedback_uri (str)
    - block_number (int)
    """
    if registry_address is None:
        registry_address = _registry_address()

    try:
        w3 = Web3(Web3.HTTPProvider(_rpc_url(), request_kwargs={"timeout": 10}))

        if not w3.is_connected():
            return []

        registry = w3.eth.contract(
            address=Web3.to_checksum_address(registry_address),
            abi=REGISTRY_ABI,
        )

        event_filter = registry.events.FeedbackSubmitted.create_filter(
            from_block=0,
            argument_filters={"agentId": agent_id},
        )

        events = event_filter.get_all_entries()
        signals = []
        for event in events:
            signals.append(
                {
                    "agent_id": event["args"]["agentId"],
                    "client_address": event["args"]["clientAddress"],
                    "feedback_index": event["args"]["feedbackIndex"],
                    "value": event["args"]["value"],
                    "tag1": event["args"]["tag1"],
                    "feedback_uri": event["args"]["feedbackURI"],
                    "block_number": event["blockNumber"],
                }
            )

        return signals

    except Exception as e:
        logger.error(
            "Failed to fetch reputation signals for agent_id=%d: %s", agent_id, e
        )
        return []


# --- Gas estimation ---

_GAS_UNITS = {
    ("aave", "deposit"): 180_000,
    ("aave", "withdraw"): 150_000,
    ("curve", "deposit"): 250_000,
    ("curve", "withdraw"): 200_000,
    ("compound", "deposit"): 160_000,
    ("compound", "withdraw"): 140_000,
}

_BASE_SEPOLIA_GAS_PRICE = 0.1  # gwei
_ETH_PRICE_USD = 3_500.0


def estimate_gas_cost(
    protocol: str,
    action: str = "deposit",
    network: str = "base",
) -> dict:
    """Estimate gas cost in USD for a given DeFi action.

    Uses known gas unit estimates and current network gas prices.
    Base Sepolia uses ~0.1 gwei; Ethereum mainnet uses ~20 gwei.
    """
    units = _GAS_UNITS.get((protocol.lower(), action.lower()), 200_000)
    gas_price_gwei = _BASE_SEPOLIA_GAS_PRICE if network == "base" else 20.0
    gas_usd = (units * gas_price_gwei * 1e-9) * _ETH_PRICE_USD

    return {
        "estimated_gas_usd": round(gas_usd, 2),
        "gas_units": units,
        "gas_price_gwei": gas_price_gwei,
    }
