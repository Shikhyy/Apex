"""Unit tests for market data tools."""

import pytest
from unittest.mock import patch, MagicMock
import asyncio

from mcp_tools.market_data import (
    fetch_aave_yields,
    fetch_curve_pools,
    fetch_volatility_index,
    fetch_sentiment,
)


def run_async(coro):
    """Run async function in test context."""
    return asyncio.run(coro)


class TestFetchAaveYields:
    """Tests for Aave yield fetching."""

    def test_returns_mock_data_on_api_failure(self):
        """Should return mock pools when API fails."""
        with patch("mcp_tools.market_data.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.side_effect = Exception("Network error")
            result = run_async(fetch_aave_yields())
            assert len(result) == 3  # 3 mock pools
            assert result[0]["protocol"] == "aave"

    def test_mock_pools_have_required_fields(self):
        """Mock pools should have all required YieldOpportunity fields."""
        with patch("mcp_tools.market_data.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.side_effect = Exception("fail")
            result = run_async(fetch_aave_yields())
            for pool in result:
                assert "protocol" in pool
                assert "pool" in pool
                assert "apy" in pool
                assert "tvl_usd" in pool
                assert "risk_score" in pool
                assert "liquidity_usd" in pool


class TestFetchCurvePools:
    """Tests for Curve pool fetching."""

    def test_returns_mock_data_on_api_failure(self):
        """Should return mock pools when API fails."""
        with patch("mcp_tools.market_data.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.side_effect = Exception("Network error")
            result = run_async(fetch_curve_pools())
            assert len(result) == 3  # 3 mock pools
            assert result[0]["protocol"] == "curve"


class TestFetchVolatilityIndex:
    """Tests for volatility index fetching."""

    def test_returns_mock_on_all_api_failures(self):
        """Should return mock value when all APIs fail."""
        with patch("mcp_tools.market_data.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.side_effect = Exception("fail")
            result = run_async(fetch_volatility_index())
            assert result == 42.3

    def test_returns_deribit_value_on_success(self):
        """Should return Deribit volatility when API succeeds."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"result": 55.5}
        mock_response.raise_for_status = MagicMock()

        with patch("mcp_tools.market_data.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get.return_value = (
                mock_response
            )
            result = run_async(fetch_volatility_index())
            assert result == 55.5


class TestFetchSentiment:
    """Tests for sentiment fetching."""

    def test_returns_mock_on_api_failure(self):
        """Should return mock sentiment when API fails."""
        with patch("mcp_tools.market_data.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.side_effect = Exception("fail")
            result = run_async(fetch_sentiment())
            assert result == 0.24

    def test_maps_fear_greed_to_sentiment_range(self):
        """Should map Fear & Greed 0-100 to -1.0 to +1.0."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"data": [{"value": "50"}]}
        mock_response.raise_for_status = MagicMock()

        with patch("mcp_tools.market_data.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get.return_value = (
                mock_response
            )
            result = run_async(fetch_sentiment())
            # 50/50 - 1 = 0.0
            assert result == 0.0
