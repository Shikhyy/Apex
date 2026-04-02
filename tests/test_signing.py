"""Unit tests for EIP-712 signing and position sizing."""

import pytest
from unittest.mock import patch

from mcp_tools.signing import (
    generate_eip712_intent,
    calculate_position_size,
    _generate_intent_hash,
)


class TestGenerateIntentHash:
    """Tests for intent hash generation."""

    def test_produces_consistent_hash(self):
        """Same input should always produce the same hash."""
        intent = {
            "opportunity": {"protocol": "aave", "pool": "USDC"},
            "amount_usd": 500.0,
            "expected_pnl": 10.0,
            "confidence": 0.85,
        }
        hash1 = _generate_intent_hash(intent)
        hash2 = _generate_intent_hash(intent)
        assert hash1 == hash2

    def test_hash_starts_with_0x(self):
        """Hash should be hex-formatted with 0x prefix."""
        intent = {
            "opportunity": {"protocol": "aave", "pool": "USDC"},
            "amount_usd": 100.0,
            "expected_pnl": 1.0,
            "confidence": 0.5,
        }
        assert _generate_intent_hash(intent).startswith("0x")

    def test_different_inputs_produce_different_hashes(self):
        """Different inputs should produce different hashes."""
        intent1 = {
            "opportunity": {"protocol": "aave", "pool": "USDC"},
            "amount_usd": 500.0,
            "expected_pnl": 10.0,
            "confidence": 0.85,
        }
        intent2 = {
            "opportunity": {"protocol": "curve", "pool": "3pool"},
            "amount_usd": 500.0,
            "expected_pnl": 10.0,
            "confidence": 0.85,
        }
        assert _generate_intent_hash(intent1) != _generate_intent_hash(intent2)


class TestGenerateEIP712Intent:
    """Tests for EIP-712 signing."""

    def test_adds_signature_and_hash(self):
        """Should augment trade intent with eip712_signature and intent_hash."""
        intent = {
            "opportunity": {"protocol": "aave", "pool": "USDC"},
            "amount_usd": 500.0,
            "expected_pnl": 10.0,
            "confidence": 0.85,
        }
        result = generate_eip712_intent(intent)
        assert "eip712_signature" in result
        assert "intent_hash" in result

    def test_mock_signature_without_private_key(self):
        """Should return mock signature when no private key is set."""
        with patch("mcp_tools.signing._get_signer", return_value=None):
            intent = {
                "opportunity": {"protocol": "aave", "pool": "USDC"},
                "amount_usd": 500.0,
                "expected_pnl": 10.0,
                "confidence": 0.85,
            }
            result = generate_eip712_intent(intent)
            assert result["eip712_signature"] == "0x" + "00" * 65


class TestCalculatePositionSize:
    """Tests for Kelly criterion position sizing."""

    def test_respects_max_position_cap(self):
        """Position should not exceed 20% of vault balance."""
        opp = {"confidence": 0.9, "apy": 10.0}
        size = calculate_position_size(
            opp, vault_balance=10000.0, volatility_index=50.0
        )
        assert size <= 2000.0  # 20% of $10,000

    def test_respects_min_position_floor(self):
        """Position should not go below $100."""
        opp = {"confidence": 0.1, "apy": 1.0}
        size = calculate_position_size(
            opp, vault_balance=10000.0, volatility_index=100.0
        )
        assert size >= 100.0

    def test_higher_volatility_reduces_position(self):
        """Higher volatility index should result in smaller position."""
        opp = {"confidence": 0.8, "apy": 10.0}
        size_low_vol = calculate_position_size(
            opp, vault_balance=10000.0, volatility_index=30.0
        )
        size_high_vol = calculate_position_size(
            opp, vault_balance=10000.0, volatility_index=80.0
        )
        assert size_high_vol <= size_low_vol

    def test_higher_confidence_increases_position(self):
        """Higher confidence should result in larger position."""
        opp_low = {"confidence": 0.5, "apy": 10.0}
        opp_high = {"confidence": 0.9, "apy": 10.0}
        size_low = calculate_position_size(
            opp_low, vault_balance=10000.0, volatility_index=50.0
        )
        size_high = calculate_position_size(
            opp_high, vault_balance=10000.0, volatility_index=50.0
        )
        assert size_high >= size_low
