import pytest
from fastapi.testclient import TestClient

from api import app

client = TestClient(app)


def test_market_prices_returns_200():
    """GET /market/prices returns price data."""
    resp = client.get("/market/prices")
    assert resp.status_code == 200
    data = resp.json()
    assert "prices" in data
    assert len(data["prices"]) > 0
    assert "symbol" in data["prices"][0]
    assert "price" in data["prices"][0]


def test_market_signals_returns_200():
    """GET /market/signals returns signal data."""
    resp = client.get("/market/signals")
    assert resp.status_code == 200
    data = resp.json()
    assert "signals" in data
    assert len(data["signals"]) > 0
    assert data["signals"][0]["signal"] in ("BULLISH", "BEARISH", "NEUTRAL")


def test_market_aerodrome_pools_returns_200():
    """GET /market/aerodrome-pools returns pool data."""
    resp = client.get("/market/aerodrome-pools")
    assert resp.status_code == 200
    data = resp.json()
    assert "pools" in data
    assert len(data["pools"]) > 0
    assert data["pools"][0]["protocol"] == "aerodrome"
