import pytest
from unittest.mock import patch

from agents.scout import scout_node


def test_scout_includes_aerodrome_pools():
    """Scout node includes Aerodrome pools in opportunities."""
    aero_pool = {
        "protocol": "aerodrome",
        "pool": "WETH/USDC",
        "apy": 12.5,
        "tvl_usd": 52_000_000,
        "risk_score": 0.20,
        "liquidity_usd": 38_000_000,
    }
    with (
        patch("agents.scout.fetch_aerodrome_pools", return_value=[aero_pool]),
        patch("agents.scout.fetch_aave_yields", return_value=[]),
        patch("agents.scout.fetch_curve_pools", return_value=[]),
        patch("agents.scout.fetch_compound_rates", return_value=[]),
        patch("agents.scout.fetch_volatility_index", return_value=42.0),
        patch("agents.scout.fetch_sentiment", return_value=0.2),
        patch("agents.scout.fetch_signals", return_value=[]),
        patch("agents.scout.fetch_risk", return_value=[]),
    ):
        result = scout_node(
            {
                "opportunities": [],
                "volatility_index": 0.0,
                "sentiment_score": 0.0,
                "scout_reasoning": "",
                "ranked_intents": [],
                "strategist_reasoning": "",
                "guardian_decision": "PENDING",
                "guardian_reason": "no_opportunities",
                "guardian_detail": "",
                "guardian_confidence": 0.0,
                "tx_hash": "",
                "executed_protocol": "",
                "actual_pnl": 0.0,
                "execution_error": "",
                "scout_agent_id": 0,
                "strategist_agent_id": 0,
                "guardian_agent_id": 0,
                "executor_agent_id": 0,
                "session_pnl": 0.0,
                "veto_count": 0,
                "approval_count": 0,
                "cycle_number": 0,
            }
        )
        assert "opportunities" in result
        assert "scout_reasoning" in result
        assert "volatility_index" in result
        assert "sentiment_score" in result


def test_scout_reasoning_present():
    """Scout reasoning is present even with LLM failure."""
    with (
        patch("agents.scout.fetch_aerodrome_pools", return_value=[]),
        patch("agents.scout.fetch_aave_yields", return_value=[]),
        patch("agents.scout.fetch_curve_pools", return_value=[]),
        patch("agents.scout.fetch_compound_rates", return_value=[]),
        patch("agents.scout.fetch_volatility_index", return_value=42.0),
        patch("agents.scout.fetch_sentiment", return_value=0.2),
        patch("agents.scout.fetch_signals", return_value=[]),
        patch("agents.scout.fetch_risk", return_value=[]),
    ):
        result = scout_node(
            {
                "opportunities": [],
                "volatility_index": 0.0,
                "sentiment_score": 0.0,
                "scout_reasoning": "",
                "ranked_intents": [],
                "strategist_reasoning": "",
                "guardian_decision": "PENDING",
                "guardian_reason": "no_opportunities",
                "guardian_detail": "",
                "guardian_confidence": 0.0,
                "tx_hash": "",
                "executed_protocol": "",
                "actual_pnl": 0.0,
                "execution_error": "",
                "scout_agent_id": 0,
                "strategist_agent_id": 0,
                "guardian_agent_id": 0,
                "executor_agent_id": 0,
                "session_pnl": 0.0,
                "veto_count": 0,
                "approval_count": 0,
                "cycle_number": 0,
            }
        )
        assert len(result["scout_reasoning"]) > 0
