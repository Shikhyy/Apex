import pytest
from unittest.mock import AsyncMock, patch

from mcp_tools.prism_api import (
    resolve_asset,
    fetch_prices,
    fetch_signals,
    fetch_risk,
)


@pytest.mark.asyncio
async def test_resolve_asset_success():
    """resolve_asset returns canonical identity on success."""
    mock_response = {
        "symbol": "BTC",
        "name": "Bitcoin",
        "id": "btc-bitcoin",
        "type": "cryptocurrency",
    }
    with (
        patch("mcp_tools.prism_api.httpx.AsyncClient") as mock_client,
        patch("mcp_tools.prism_api.API_KEY", "test-key"),
    ):
        client_instance = AsyncMock()
        resp_mock = AsyncMock()
        resp_mock.raise_for_status = AsyncMock()
        resp_mock.json.return_value = mock_response
        client_instance.get.return_value = resp_mock
        mock_client.return_value.__aenter__.return_value = client_instance
        result = await resolve_asset("BTC")
        assert result["symbol"] == "BTC"
        assert "id" in result


@pytest.mark.asyncio
async def test_resolve_asset_fallback():
    """resolve_asset returns mock data on API failure."""
    with (
        patch("mcp_tools.prism_api.httpx.AsyncClient") as mock_client,
        patch("mcp_tools.prism_api.API_KEY", "test-key"),
    ):
        mock_client.return_value.__aenter__.side_effect = Exception("network error")
        result = await resolve_asset("BTC")
        assert result["symbol"] == "BTC"
        assert "id" in result


@pytest.mark.asyncio
async def test_fetch_prices_success():
    """fetch_prices returns price data for multiple symbols."""
    mock_response = {
        "symbol": "BTC",
        "price": 68400.0,
        "change_24h": 2.5,
        "timestamp": "2026-04-02T00:00:00Z",
    }
    with (
        patch("mcp_tools.prism_api.httpx.AsyncClient") as mock_client,
        patch("mcp_tools.prism_api.API_KEY", "test-key"),
    ):
        client_instance = AsyncMock()
        resp_mock = AsyncMock()
        resp_mock.raise_for_status = AsyncMock()
        resp_mock.json.return_value = mock_response
        client_instance.get.return_value = resp_mock
        mock_client.return_value.__aenter__.return_value = client_instance
        results = await fetch_prices(["BTC", "ETH"])
        assert len(results) >= 1
        assert results[0]["symbol"] == "BTC"


@pytest.mark.asyncio
async def test_fetch_signals_success():
    """fetch_signals returns signal data."""
    mock_response = {
        "symbol": "BTC",
        "signal": "BULLISH",
        "confidence": 0.72,
        "reasoning": "test",
    }
    with (
        patch("mcp_tools.prism_api.httpx.AsyncClient") as mock_client,
        patch("mcp_tools.prism_api.API_KEY", "test-key"),
    ):
        client_instance = AsyncMock()
        resp_mock = AsyncMock()
        resp_mock.raise_for_status = AsyncMock()
        resp_mock.json.return_value = mock_response
        client_instance.get.return_value = resp_mock
        mock_client.return_value.__aenter__.return_value = client_instance
        results = await fetch_signals(["BTC"])
        assert len(results) >= 1
        assert results[0]["signal"] in ("BULLISH", "BEARISH", "NEUTRAL")


@pytest.mark.asyncio
async def test_fetch_risk_success():
    """fetch_risk returns volatility and risk metrics."""
    mock_response = {
        "symbol": "BTC",
        "volatility": 65.2,
        "risk_score": 0.45,
        "sharpe_ratio": 1.8,
    }
    with (
        patch("mcp_tools.prism_api.httpx.AsyncClient") as mock_client,
        patch("mcp_tools.prism_api.API_KEY", "test-key"),
    ):
        client_instance = AsyncMock()
        resp_mock = AsyncMock()
        resp_mock.raise_for_status = AsyncMock()
        resp_mock.json.return_value = mock_response
        client_instance.get.return_value = resp_mock
        mock_client.return_value.__aenter__.return_value = client_instance
        results = await fetch_risk(["BTC"])
        assert len(results) >= 1
        assert 0 <= results[0]["risk_score"] <= 1


@pytest.mark.asyncio
async def test_fetch_risk_fallback():
    """fetch_risk returns mock data on failure."""
    with (
        patch("mcp_tools.prism_api.httpx.AsyncClient") as mock_client,
        patch("mcp_tools.prism_api.API_KEY", "test-key"),
    ):
        mock_client.return_value.__aenter__.side_effect = Exception("timeout")
        results = await fetch_risk(["BTC"])
        assert len(results) >= 1
        assert "volatility" in results[0]
