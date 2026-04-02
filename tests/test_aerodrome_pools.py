import pytest
from unittest.mock import AsyncMock, patch

from mcp_tools.aerodrome_pools import fetch_aerodrome_pools


@pytest.mark.asyncio
async def test_fetch_aerodrome_pools_success():
    """fetch_aerodrome_pools returns pool data from subgraph."""
    mock_data = {
        "data": {
            "pools": [
                {
                    "id": "0x123",
                    "token0": {"symbol": "WETH"},
                    "token1": {"symbol": "USDC"},
                    "reserveUSD": "50000000",
                    "volumeUSD": "10000000",
                    "feeAPR": "0.045",
                    "totalSupply": "1000000",
                }
            ]
        }
    }
    with patch("mcp_tools.aerodrome_pools.httpx.AsyncClient") as mock_client:
        client_instance = AsyncMock()
        resp_mock = AsyncMock()
        resp_mock.raise_for_status = AsyncMock()
        resp_mock.json.return_value = mock_data
        client_instance.post.return_value = resp_mock
        mock_client.return_value.__aenter__.return_value = client_instance
        pools = await fetch_aerodrome_pools()
        assert len(pools) >= 1
        assert pools[0]["protocol"] == "aerodrome"
        assert pools[0]["tvl_usd"] > 0


@pytest.mark.asyncio
async def test_fetch_aerodrome_pools_fallback():
    """fetch_aerodrome_pools returns mock pools on failure."""
    with patch("mcp_tools.aerodrome_pools.httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.side_effect = Exception("timeout")
        pools = await fetch_aerodrome_pools()
        assert len(pools) >= 3
        assert all(p["protocol"] == "aerodrome" for p in pools)
        assert all(p["tvl_usd"] > 0 for p in pools)
        assert all(0 <= p["risk_score"] <= 1 for p in pools)


@pytest.mark.asyncio
async def test_mock_pools_have_realistic_values():
    """Mock Aerodrome pools have realistic TVL and APY."""
    from mcp_tools.aerodrome_pools import _MOCK_AERO_POOLS

    for pool in _MOCK_AERO_POOLS:
        assert pool["tvl_usd"] >= 500_000
        assert 0 < pool["apy"] < 100
        assert 0 <= pool["risk_score"] <= 1
        assert pool["liquidity_usd"] > 0
