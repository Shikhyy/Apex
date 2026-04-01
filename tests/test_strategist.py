"""Smoke tests for strategist node."""

import pytest
from agents.strategist import strategist_node


def test_empty_opportunities():
    state = {
        "opportunities": [],
        "volatility_index": 50.0,
        "sentiment_score": 0.5,
    }
    result = strategist_node(state)
    assert result["ranked_intents"] == []
    assert "No opportunities" in result["strategist_reasoning"]


def test_single_low_risk_opportunity():
    state = {
        "opportunities": [
            {
                "protocol": "Aave",
                "pool": "USDC/ETH",
                "apy": 12.5,
                "tvl_usd": 500_000_000,
                "risk_score": 20.0,
                "liquidity_usd": 100_000_000,
            }
        ],
        "volatility_index": 30.0,
        "sentiment_score": 0.7,
    }
    result = strategist_node(state)
    assert len(result["ranked_intents"]) == 1
    intent = result["ranked_intents"][0]
    assert intent["amount_usd"] > 0
    assert intent["expected_pnl"] > 0
    assert intent["confidence"] >= 0.5
    assert len(intent["eip712_signature"]) > 10
    assert len(intent["intent_hash"]) > 0


def test_multiple_mixed_risk_opportunities():
    state = {
        "opportunities": [
            {
                "protocol": "Aave",
                "pool": "USDC/ETH",
                "apy": 12.5,
                "tvl_usd": 500_000_000,
                "risk_score": 20.0,
                "liquidity_usd": 100_000_000,
            },
            {
                "protocol": "Uniswap",
                "pool": "WBTC/USDC",
                "apy": 25.0,
                "tvl_usd": 200_000_000,
                "risk_score": 60.0,
                "liquidity_usd": 50_000_000,
            },
            {
                "protocol": "Curve",
                "pool": "3pool",
                "apy": 5.0,
                "tvl_usd": 1_000_000_000,
                "risk_score": 10.0,
                "liquidity_usd": 500_000_000,
            },
        ],
        "volatility_index": 40.0,
        "sentiment_score": 0.6,
    }
    result = strategist_node(state)
    # risk_score 60 → confidence 0.4 → below threshold → excluded
    assert len(result["ranked_intents"]) == 2
    # Sorted by confidence descending
    assert (
        result["ranked_intents"][0]["confidence"]
        >= result["ranked_intents"][1]["confidence"]
    )


def test_all_high_risk_opportunities_excluded():
    state = {
        "opportunities": [
            {
                "protocol": "DegenFarm",
                "pool": "MEME/ETH",
                "apy": 500.0,
                "tvl_usd": 1_000_000,
                "risk_score": 80.0,
                "liquidity_usd": 100_000,
            },
        ],
        "volatility_index": 90.0,
        "sentiment_score": 0.2,
    }
    result = strategist_node(state)
    assert len(result["ranked_intents"]) == 0
    assert "Excluded" in result["strategist_reasoning"]
