"""Unit tests for Guardian agent veto logic."""

import sys
import os
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from agents.guardian import guardian_node, VETO_THRESHOLDS


def _make_state(**overrides) -> dict:
    """Build a minimal APEXState-compatible dict for testing."""
    state = {
        "opportunities": [],
        "volatility_index": 30.0,
        "sentiment_score": 0.2,
        "scout_reasoning": "Test market data",
        "ranked_intents": [
            {
                "opportunity": {
                    "protocol": "aave",
                    "pool": "USDC-v3",
                    "apy": 4.23,
                    "tvl_usd": 2_400_000_000,
                    "risk_score": 0.15,
                    "liquidity_usd": 1_800_000_000,
                },
                "amount_usd": 500.0,
                "expected_pnl": 10.0,
                "confidence": 0.85,
                "eip712_signature": "0xabc123",
                "intent_hash": "0xdef456",
            }
        ],
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
    state.update(overrides)
    return state


def test_guardian_vetoes_high_volatility():
    """Guardian must veto when volatility index exceeds threshold."""
    state = _make_state(volatility_index=80.0)
    result = guardian_node(state)
    assert result["guardian_decision"] == "VETOED"
    assert result["guardian_reason"] == "volatility_spike"
    assert "80.0" in result["guardian_detail"]
    assert result["guardian_confidence"] == 1.0


def test_guardian_vetoes_suspicious_apy():
    """Guardian must veto when APY exceeds suspicious threshold."""
    state = _make_state(
        ranked_intents=[
            {
                "opportunity": {
                    "protocol": "curve",
                    "pool": "suspicious-pool",
                    "apy": 120.0,
                    "tvl_usd": 1_000_000,
                    "risk_score": 0.9,
                    "liquidity_usd": 800_000,
                },
                "amount_usd": 200.0,
                "expected_pnl": 50.0,
                "confidence": 0.3,
                "eip712_signature": "0x",
                "intent_hash": "0x",
            }
        ]
    )
    result = guardian_node(state)
    assert result["guardian_decision"] == "VETOED"
    assert result["guardian_reason"] == "suspicious_apy"
    assert "120.0" in result["guardian_detail"]


def test_guardian_vetoes_low_liquidity():
    """Guardian must veto when pool liquidity is below minimum."""
    state = _make_state(
        ranked_intents=[
            {
                "opportunity": {
                    "protocol": "aave",
                    "pool": "low-liq-pool",
                    "apy": 5.0,
                    "tvl_usd": 500_000,
                    "risk_score": 0.3,
                    "liquidity_usd": 100_000,
                },
                "amount_usd": 100.0,
                "expected_pnl": 2.0,
                "confidence": 0.7,
                "eip712_signature": "0x",
                "intent_hash": "0x",
            }
        ]
    )
    result = guardian_node(state)
    assert result["guardian_decision"] == "VETOED"
    assert result["guardian_reason"] == "low_liquidity"


def test_guardian_vetoes_negative_sentiment():
    """Guardian must veto when sentiment score is too negative."""
    state = _make_state(sentiment_score=-0.8)
    result = guardian_node(state)
    assert result["guardian_decision"] == "VETOED"
    assert result["guardian_reason"] == "negative_sentiment"


def test_guardian_vetoes_no_opportunities():
    """Guardian must veto when there are no ranked intents."""
    state = _make_state(ranked_intents=[])
    result = guardian_node(state)
    assert result["guardian_decision"] == "VETOED"
    assert result["guardian_reason"] == "no_opportunities"


def test_guardian_defaults_to_veto_on_parse_error():
    """Guardian must default to VETO if LLM returns unparseable output."""
    state = _make_state(volatility_index=30.0, sentiment_score=0.2)

    # We can't easily mock the LLM in this test without extra deps,
    # but we can verify the fallback path works by checking the
    # structure of error responses. This test documents the expected
    # behavior: any exception during LLM evaluation → VETO.
    # The actual LLM path is tested in integration tests.
    pass  # LLM-dependent; covered by integration tests


def test_threshold_values_are_reasonable():
    """VETO_THRESHOLDS should have sensible default values."""
    assert VETO_THRESHOLDS["max_volatility_idx"] == 65.0
    assert VETO_THRESHOLDS["max_apy_suspicious"] == 50.0
    assert VETO_THRESHOLDS["min_liquidity_usd"] == 500_000
    assert VETO_THRESHOLDS["min_sentiment"] == -0.5
    assert VETO_THRESHOLDS["min_scout_rep"] == 0.40
    assert VETO_THRESHOLDS["max_drawdown_pct"] == 5.0


def test_guardian_at_boundary_volatility():
    """Guardian should NOT veto when volatility is exactly at threshold."""
    state = _make_state(volatility_index=65.0)
    result = guardian_node(state)
    # At exactly 65.0, the pre-check should NOT trigger (> not >=)
    # The LLM may still veto, but the deterministic pre-check passes
    if result["guardian_reason"] == "volatility_spike":
        # This would be a bug — we use > not >=
        assert False, "Should not veto at exactly threshold (uses > not >=)"


def test_guardian_at_boundary_apy():
    """Guardian should NOT veto when APY is exactly at threshold."""
    state = _make_state(
        ranked_intents=[
            {
                "opportunity": {
                    "protocol": "aave",
                    "pool": "USDC-v3",
                    "apy": 50.0,
                    "tvl_usd": 2_400_000_000,
                    "risk_score": 0.15,
                    "liquidity_usd": 1_800_000_000,
                },
                "amount_usd": 500.0,
                "expected_pnl": 10.0,
                "confidence": 0.85,
                "eip712_signature": "0x",
                "intent_hash": "0x",
            }
        ]
    )
    result = guardian_node(state)
    # At exactly 50.0, the pre-check should NOT trigger (> not >=)
    if result["guardian_reason"] == "suspicious_apy":
        assert False, "Should not veto at exactly APY threshold (uses > not >=)"


@patch("agents.guardian.fetch_agent_reputation", return_value={"normalized": 1.0})
@patch("agents.guardian.calculate_projected_drawdown", return_value=1.0)
@patch("agents.guardian._post_guardian_signal")
@patch("agents.guardian._get_llm", return_value=None)
def test_guardian_approves_without_groq_when_safe(
    mock_get_llm,
    mock_post_guardian_signal,
    mock_drawdown,
    mock_reputation,
):
    """Guardian should approve deterministically when Groq is unavailable and the trade is safe."""
    state = _make_state()
    result = guardian_node(state)

    assert result["guardian_decision"] == "APPROVED"
    assert result["guardian_reason"] == "safe_to_proceed"
    assert "deterministic approval" in result["guardian_detail"].lower()
    assert result["guardian_confidence"] == 0.55
    mock_post_guardian_signal.assert_called_once()
