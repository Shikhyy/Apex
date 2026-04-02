"""Unit tests for trade execution tools."""

import pytest
from unittest.mock import patch, MagicMock
import asyncio

from mcp_tools.execution import (
    execute_surge_intent,
    execute_kraken_order,
    calculate_realized_pnl,
)


def run_async(coro):
    """Run async function in test context."""
    return asyncio.run(coro)


class TestExecuteSurgeIntent:
    """Tests for Surge Risk Router execution."""

    def test_mock_execution_when_no_credentials(self):
        """Should use mock execution when no API key configured."""
        with patch("mcp_tools.execution.SURGE_API_KEY", ""):
            result = run_async(
                execute_surge_intent(
                    {
                        "amount": 500.0,
                        "token": "USDC",
                        "protocol": "aave",
                    }
                )
            )
            assert result["status"] == "success"
            assert result["tx_hash"].startswith("0xmock")

    def test_returns_failed_on_unexpected_error(self):
        """Should return failed status on unexpected errors (not httpx.RequestError)."""
        with patch("mcp_tools.execution.SURGE_API_KEY", "test-key"):
            with patch("mcp_tools.execution.SURGE_VAULT_ADDRESS", "0x123"):
                with patch("mcp_tools.execution.httpx.AsyncClient") as mock_client:
                    mock_client.return_value.__aenter__.side_effect = Exception(
                        "API down"
                    )
                    result = run_async(
                        execute_surge_intent({"amount": 100.0, "token": "USDC"})
                    )
                    assert result["status"] == "failed"
                    assert "API down" in result["error"]


class TestExecuteKrakenOrder:
    """Tests for Kraken CEX execution."""

    @patch("mcp_tools.execution.shutil.which")
    def test_mock_when_cli_not_found(self, mock_which):
        """Should use mock execution when Kraken CLI is not installed."""
        mock_which.return_value = None
        result = execute_kraken_order("ETH/USD", 1000.0, "buy")
        assert result["status"] == "success"
        assert result["order_id"].startswith("MOCK-")

    def test_mock_has_required_fields(self):
        """Mock response should have all required fields."""
        with patch("mcp_tools.execution.shutil.which", return_value=None):
            result = execute_kraken_order("ETH/USD", 500.0, "sell")
            assert "order_id" in result
            assert "status" in result
            assert "filled_amount" in result
            assert "avg_price" in result
            assert "error" in result


class TestCalculateRealizedPnL:
    """Tests for PnL calculation."""

    def test_profit_scenario(self):
        """Should calculate positive PnL on profitable trade."""
        pnl = calculate_realized_pnl(
            entry_value=1000.0, exit_value=1050.0, gas_cost=5.0
        )
        assert pnl == 45.0

    def test_loss_scenario(self):
        """Should calculate negative PnL on losing trade."""
        pnl = calculate_realized_pnl(entry_value=1000.0, exit_value=950.0, gas_cost=5.0)
        assert pnl == -55.0

    def test_break_even(self):
        """Should return negative gas cost on break-even trade."""
        pnl = calculate_realized_pnl(
            entry_value=1000.0, exit_value=1000.0, gas_cost=10.0
        )
        assert pnl == -10.0

    def test_zero_gas_cost(self):
        """Should default gas cost to 0.0."""
        pnl = calculate_realized_pnl(entry_value=1000.0, exit_value=1100.0)
        assert pnl == 100.0
