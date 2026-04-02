"""Unit tests for Executor agent trade execution."""

import pytest
from unittest.mock import patch, MagicMock

from agents.executor import (
    executor_node,
    veto_node,
)


class TestExecutorNode:
    """Tests for the executor_node entry point."""

    def _make_state(self, intents=None, **overrides):
        state = {
            "opportunities": [],
            "volatility_index": 30.0,
            "sentiment_score": 0.2,
            "scout_reasoning": "",
            "ranked_intents": intents or [],
            "strategist_reasoning": "",
            "guardian_decision": "APPROVED",
            "guardian_reason": "safe_to_proceed",
            "guardian_detail": "",
            "guardian_confidence": 0.8,
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

    def test_returns_error_on_no_intents(self):
        """Should return error when no ranked intents available."""
        state = self._make_state(intents=[])
        result = executor_node(state)
        assert result["execution_error"] == "No ranked intents available."
        assert result["tx_hash"] == ""

    @patch("agents.executor._attempt_real_execution")
    def test_executes_on_approved_intent(self, mock_exec):
        """Should execute trade when intent is approved."""
        mock_exec.return_value = {
            "execution_time": 1.0,
            "actual_pnl": 10.0,
        }

        intents = [
            {
                "opportunity": {"protocol": "aave", "pool": "USDC-v3", "apy": 4.23},
                "amount_usd": 500.0,
                "expected_pnl": 10.0,
                "confidence": 0.85,
                "eip712_signature": "0xabc",
                "intent_hash": "0xdef",
            }
        ]
        state = self._make_state(intents=intents)
        result = executor_node(state)

        assert result["tx_hash"].startswith("0x")
        assert result["executed_protocol"] == "aave"
        assert result["actual_pnl"] == 10.0
        assert result["execution_error"] == ""

    @patch("agents.executor._attempt_real_execution")
    def test_handles_execution_failure(self, mock_exec):
        """Should handle execution errors gracefully."""
        mock_exec.side_effect = Exception("Connection refused")

        intents = [
            {
                "opportunity": {"protocol": "aave", "pool": "USDC-v3", "apy": 4.23},
                "amount_usd": 300.0,
                "expected_pnl": 5.0,
                "confidence": 0.7,
                "eip712_signature": "0xabc",
                "intent_hash": "0xdef",
            }
        ]
        state = self._make_state(intents=intents)
        result = executor_node(state)

        assert "Connection refused" in result["execution_error"]
        assert result["actual_pnl"] == 0.0


class TestVetoNode:
    """Tests for the veto_node entry point."""

    def _make_state(self, intents=None, **overrides):
        state = {
            "opportunities": [],
            "volatility_index": 30.0,
            "sentiment_score": 0.2,
            "scout_reasoning": "",
            "ranked_intents": intents or [],
            "strategist_reasoning": "",
            "guardian_decision": "VETOED",
            "guardian_reason": "volatility_spike",
            "guardian_detail": "Test",
            "guardian_confidence": 1.0,
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

    def test_increments_veto_count(self):
        """Should increment veto_count by 1."""
        state = self._make_state()
        result = veto_node(state)
        assert result["veto_count"] == 1

    def test_returns_empty_execution_fields(self):
        """Should return empty tx_hash and pnl for vetoed trades."""
        state = self._make_state()
        result = veto_node(state)
        assert result["tx_hash"] == ""
        assert result["actual_pnl"] == 0.0
        assert result["execution_error"] == ""

    def test_logs_vetoed_intent_details(self):
        """Should log vetoed intent details when available."""
        intents = [
            {
                "opportunity": {"protocol": "curve", "pool": "3pool"},
                "amount_usd": 200.0,
                "expected_pnl": 5.0,
                "confidence": 0.6,
                "eip712_signature": "0x",
                "intent_hash": "0x",
            }
        ]
        state = self._make_state(intents=intents)
        result = veto_node(state)
        assert result["veto_count"] == 1
        assert result["tx_hash"] == ""
