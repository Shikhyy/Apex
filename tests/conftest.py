"""Shared pytest fixtures for APEX tests."""

import os
import sys
import asyncio
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


@pytest.fixture(autouse=True)
def mock_env_vars():
    """Set safe default env vars for all tests."""
    with patch.dict(
        os.environ,
        {
            "GROQ_API_KEY": "test_groq_key",
            "APEX_PRIVATE_KEY": "0x" + "01" * 32,
            "BASE_SEPOLIA_RPC": "https://sepolia.base.org",
            "PINATA_JWT": "",
            "SURGE_API_KEY": "",
            "KRAKEN_API_KEY": "",
        },
        clear=False,
    ):
        yield


@pytest.fixture(autouse=True)
def mock_reputation():
    """Mock on-chain reputation calls to avoid network requests in tests."""
    with patch(
        "mcp_tools.risk_analysis.fetch_agent_reputation",
        return_value={
            "agent_id": 1,
            "avg_score": 20.0,
            "normalized": 0.6,
            "count": 5,
        },
    ):
        yield


@pytest.fixture
def sample_yield_opportunity():
    """A standard yield opportunity dict for testing."""
    return {
        "protocol": "aave",
        "pool": "USDC-v3",
        "apy": 4.23,
        "tvl_usd": 2_400_000_000,
        "risk_score": 0.15,
        "liquidity_usd": 1_800_000_000,
    }


@pytest.fixture
def sample_trade_intent(sample_yield_opportunity):
    """A standard trade intent dict for testing."""
    return {
        "opportunity": sample_yield_opportunity,
        "amount_usd": 500.0,
        "expected_pnl": 10.0,
        "confidence": 0.85,
        "eip712_signature": "0xabc123",
        "intent_hash": "0xdef456",
    }


@pytest.fixture
def sample_apex_state(sample_yield_opportunity, sample_trade_intent):
    """A standard APEXState-compatible dict for testing."""
    return {
        "opportunities": [sample_yield_opportunity],
        "volatility_index": 30.0,
        "sentiment_score": 0.2,
        "scout_reasoning": "Test market data",
        "ranked_intents": [sample_trade_intent],
        "strategist_reasoning": "Top opportunity selected",
        "guardian_decision": "PENDING",
        "guardian_reason": "no_opportunities",
        "guardian_detail": "",
        "guardian_confidence": 0.0,
        "tx_hash": "",
        "executed_protocol": "",
        "actual_pnl": 0.0,
        "execution_error": "",
        "scout_agent_id": 1,
        "strategist_agent_id": 2,
        "guardian_agent_id": 3,
        "executor_agent_id": 4,
        "session_pnl": 0.0,
        "veto_count": 0,
        "approval_count": 0,
        "cycle_number": 1,
    }


def run_async(coro):
    """Run an async function in a new event loop for test compatibility."""
    try:
        loop = asyncio.new_event_loop()
        return loop.run_until_complete(coro)
    finally:
        loop.close()
