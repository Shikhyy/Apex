"""Unit tests for Scout agent market intelligence logic."""

import pytest
from unittest.mock import patch, MagicMock

from agents.scout import scout_node, _parse_llm_response, _fetch_all_market_data
from agents.graph import YieldOpportunity


def _make_state(**overrides) -> dict:
    """Build a minimal APEXState-compatible dict."""
    state = {
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


class TestParseLLMResponse:
    """Tests for _parse_llm_response JSON parsing."""

    def test_parses_valid_json_list(self):
        """Should parse a valid JSON list of opportunities."""
        text = '[{"protocol": "aave", "pool": "USDC", "apy": 5.0, "tvl_usd": 1000000, "risk_score": 0.2, "liquidity_usd": 800000}]'
        raw = []
        result = _parse_llm_response(text, raw)
        assert len(result) == 1
        assert result[0]["protocol"] == "aave"
        assert result[0]["apy"] == 5.0

    def test_parses_valid_json_dict_with_opportunities_key(self):
        """Should parse a dict with 'opportunities' key."""
        text = '{"opportunities": [{"protocol": "curve", "pool": "3pool", "apy": 3.5, "tvl_usd": 500000, "risk_score": 0.1, "liquidity_usd": 800000}]}'
        raw = []
        result = _parse_llm_response(text, raw)
        assert len(result) == 1
        assert result[0]["protocol"] == "curve"

    def test_strips_markdown_code_fences(self):
        """Should handle markdown code fences around JSON."""
        text = '```json\n[{"protocol": "aave", "pool": "USDC", "apy": 4.0, "tvl_usd": 1000000, "risk_score": 0.1, "liquidity_usd": 800000}]\n```'
        raw = []
        result = _parse_llm_response(text, raw)
        assert len(result) == 1

    def test_falls_back_to_raw_data_on_parse_error(self):
        """Should return raw opportunities when LLM response is not valid JSON."""
        text = "not valid json at all"
        raw = [
            YieldOpportunity(
                protocol="aave",
                pool="USDC",
                apy=4.0,
                tvl_usd=1000000,
                risk_score=0.1,
                liquidity_usd=800000,
            )
        ]
        result = _parse_llm_response(text, raw)
        assert len(result) == 1
        assert result[0]["protocol"] == "aave"

    def test_excludes_low_liquidity_pools(self):
        """Should exclude pools with liquidity < $500,000."""
        text = '[{"protocol": "unknown", "pool": "tiny", "apy": 100.0, "tvl_usd": 10000, "risk_score": 0.9, "liquidity_usd": 5000}]'
        raw = []
        result = _parse_llm_response(text, raw)
        assert len(result) == 0

    def test_flags_high_apy_as_suspicious(self):
        """Should set risk_score to 0.95 for APY > 50%."""
        text = '[{"protocol": "rug", "pool": "pool", "apy": 200.0, "tvl_usd": 1000000, "risk_score": 0.3, "liquidity_usd": 800000}]'
        raw = []
        result = _parse_llm_response(text, raw)
        assert len(result) == 1
        assert result[0]["risk_score"] == 0.95


class TestFetchAllMarketData:
    """Tests for _fetch_all_market_data concurrent fetching."""

    @patch("agents.scout.fetch_risk")
    @patch("agents.scout.fetch_signals")
    @patch("agents.scout.fetch_sentiment")
    @patch("agents.scout.fetch_volatility_index")
    @patch("agents.scout.fetch_aerodrome_pools")
    @patch("agents.scout.fetch_compound_rates")
    @patch("agents.scout.fetch_curve_pools")
    @patch("agents.scout.fetch_aave_yields")
    def test_returns_all_eight_data_sources(
        self,
        mock_aave,
        mock_curve,
        mock_compound,
        mock_aero,
        mock_vol,
        mock_sentiment,
        mock_signals,
        mock_risk,
    ):
        """Should return aave, curve, compound, aero pools, vol, sentiment, signals, risk."""
        mock_aave.return_value = [
            YieldOpportunity(
                protocol="aave",
                pool="USDC",
                apy=4.0,
                tvl_usd=1000000,
                risk_score=0.1,
                liquidity_usd=800000,
            )
        ]
        mock_curve.return_value = []
        mock_compound.return_value = []
        mock_aero.return_value = []
        mock_vol.return_value = 42.0
        mock_sentiment.return_value = 0.3
        mock_signals.return_value = []
        mock_risk.return_value = {}

        result = _fetch_all_market_data()

        assert len(result) == 8
        assert len(result[0]) == 1  # aave pools
        assert result[4] == 42.0  # volatility
        assert result[5] == 0.3  # sentiment


class TestScoutNode:
    """Tests for the scout_node entry point."""

    @patch("agents.scout._fetch_all_market_data")
    @patch("agents.scout._get_llm")
    def test_returns_opportunities_from_llm(self, mock_llm, mock_fetch):
        """Should return opportunities synthesized by LLM."""
        mock_fetch.return_value = (
            [
                YieldOpportunity(
                    protocol="aave",
                    pool="USDC",
                    apy=4.0,
                    tvl_usd=1000000,
                    risk_score=0.1,
                    liquidity_usd=800000,
                )
            ],
            [],
            [],
            [],
            30.0,
            0.2,
            [],
            {},
        )
        mock_llm.return_value.invoke.return_value = MagicMock(
            content='{"opportunities": [{"protocol": "aave", "pool": "USDC", "apy": 4.0, "tvl_usd": 1000000, "risk_score": 0.1, "liquidity_usd": 800000}]}'
        )

        state = _make_state()
        result = scout_node(state)

        assert len(result["opportunities"]) == 1
        assert result["volatility_index"] == 30.0
        assert result["sentiment_score"] == 0.2
        assert "opportunities" in result["scout_reasoning"]

    @patch("agents.scout._fetch_all_market_data")
    @patch("agents.scout._get_llm")
    def test_falls_back_to_raw_data_on_llm_error(self, mock_llm, mock_fetch):
        """Should use raw market data when LLM call fails."""
        mock_fetch.return_value = (
            [
                YieldOpportunity(
                    protocol="aave",
                    pool="USDC",
                    apy=4.0,
                    tvl_usd=1000000,
                    risk_score=0.1,
                    liquidity_usd=800000,
                )
            ],
            [],
            [],
            [],
            30.0,
            0.2,
            [],
            {},
        )
        mock_llm.return_value.invoke.side_effect = Exception("API error")

        state = _make_state()
        result = scout_node(state)

        assert len(result["opportunities"]) == 1
        assert result["opportunities"][0]["protocol"] == "aave"

    @patch("agents.scout._fetch_all_market_data")
    def test_returns_empty_on_total_error(self, mock_fetch):
        """Should return safe defaults when everything fails."""
        mock_fetch.side_effect = Exception("Network error")

        state = _make_state()
        result = scout_node(state)

        assert result["opportunities"] == []
        assert result["volatility_index"] == 50.0
        assert result["sentiment_score"] == 0.0
        assert "error" in result["scout_reasoning"].lower()
