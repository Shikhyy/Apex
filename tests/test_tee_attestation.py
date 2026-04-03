"""Unit tests for TEE attestation module."""

import json
import pytest
from unittest.mock import patch

from mcp_tools.tee_attestation import (
    generate_execution_proof,
    verify_attestation,
    generate_agent_proof,
    get_tee_status,
    _compute_hash,
    _compute_hmac,
    _build_document_hash_chain,
    _simulate_cose_signature,
    _get_attestation_key,
    TEE_VERSION,
    TEE_ENCLAVE_ID,
    SIMULATED_PCRS,
)


SAMPLE_CYCLE_DATA = {
    "cycle_number": 42,
    "inputs": {
        "market_signals": {"eth_usd": 3500.0, "volatility": 45.2},
        "opportunities": [
            {"protocol": "aave", "pool": "USDC", "apy": 8.5, "confidence": 0.85},
        ],
    },
    "guardian_decision": "approve",
    "executor_result": {
        "tx_hash": "0xabc123",
        "status": "success",
        "executed_amount": 500.0,
    },
    "agent_decisions": [
        {"agent_id": 1, "role": "scout", "decision": "signal_buy", "confidence": 0.9},
        {"agent_id": 2, "role": "guardian", "decision": "approve", "risk_score": 0.2},
        {"agent_id": 3, "role": "executor", "decision": "execute", "slippage": 0.01},
    ],
}


class TestComputeHash:
    """Tests for SHA-256 hash computation."""

    def test_produces_hex_string(self):
        result = _compute_hash("hello")
        assert isinstance(result, str)
        assert len(result) == 64  # SHA-256 hex length

    def test_deterministic(self):
        h1 = _compute_hash("test")
        h2 = _compute_hash("test")
        assert h1 == h2

    def test_different_inputs_different_hashes(self):
        h1 = _compute_hash("a")
        h2 = _compute_hash("b")
        assert h1 != h2


class TestComputeHmac:
    """Tests for HMAC-SHA256 computation."""

    def test_produces_hex_string(self):
        result = _compute_hmac(b"key", "message")
        assert isinstance(result, str)
        assert len(result) == 64

    def test_same_key_message_same_result(self):
        h1 = _compute_hmac(b"key", "msg")
        h2 = _compute_hmac(b"key", "msg")
        assert h1 == h2

    def test_different_key_different_result(self):
        h1 = _compute_hmac(b"key1", "msg")
        h2 = _compute_hmac(b"key2", "msg")
        assert h1 != h2


class TestBuildDocumentHashChain:
    """Tests for hash chain construction."""

    def test_chain_length_matches_components(self):
        components = ["a", "b", "c"]
        result = _build_document_hash_chain(components)
        assert len(result["chain"]) == 3

    def test_root_hash_is_final_link_hash(self):
        components = ["x", "y"]
        result = _build_document_hash_chain(components)
        assert result["root_hash"] == result["chain"][-1]["hash"]

    def test_chain_indices_are_sequential(self):
        components = ["a", "b", "c", "d"]
        result = _build_document_hash_chain(components)
        indices = [link["index"] for link in result["chain"]]
        assert indices == [0, 1, 2, 3]

    def test_empty_components(self):
        result = _build_document_hash_chain([])
        assert len(result["chain"]) == 0
        assert result["root_hash"] == "0" * 64


class TestSimulateCoseSignature:
    """Tests for COSE signature simulation."""

    def test_has_required_fields(self):
        sig = _simulate_cose_signature(b"key", "payload")
        assert "protected" in sig
        assert "unprotected" in sig
        assert "signature" in sig
        assert "payload_hash" in sig

    def test_signature_starts_with_0x(self):
        sig = _simulate_cose_signature(b"key", "payload")
        assert sig["signature"].startswith("0x")

    def test_protected_header_has_alg(self):
        sig = _simulate_cose_signature(b"key", "payload")
        assert sig["protected"]["alg"] == "ES256"

    def test_unprotected_has_tee_type(self):
        sig = _simulate_cose_signature(b"key", "payload")
        assert sig["unprotected"]["tee"] == "aws-nitro-enclave"


class TestGetAttestationKey:
    """Tests for attestation key loading."""

    def test_returns_bytes(self):
        key = _get_attestation_key()
        assert isinstance(key, bytes)

    def test_uses_env_var_when_set(self):
        with patch.dict("os.environ", {"APEX_ATTESTATION_KEY": "test-key-123"}):
            # Reset cached key
            import mcp_tools.tee_attestation as mod

            mod._ATTESTATION_KEY = None
            key = mod._get_attestation_key()
            assert key == b"test-key-123"
            # Reset for other tests
            mod._ATTESTATION_KEY = None

    def test_fallback_when_no_env(self):
        import mcp_tools.tee_attestation as mod

        mod._ATTESTATION_KEY = None
        with patch.dict("os.environ", {}, clear=True):
            # Remove the key if it exists
            if "APEX_ATTESTATION_KEY" in mod.os.environ:
                del mod.os.environ["APEX_ATTESTATION_KEY"]
            key = mod._get_attestation_key()
            assert key == b"apex-tee-simulated-key-2026"
            mod._ATTESTATION_KEY = None


class TestGenerateExecutionProof:
    """Tests for execution proof generation."""

    def test_returns_dict_with_required_fields(self):
        proof = generate_execution_proof(SAMPLE_CYCLE_DATA)
        required = [
            "version",
            "enclave_id",
            "pcrs",
            "nonce",
            "timestamp",
            "cycle_number",
            "inputs_hash",
            "guardian_decision",
            "executor_result_hash",
            "decision_hash",
            "hash_chain",
            "signature",
            "attestation_type",
        ]
        for field in required:
            assert field in proof, f"Missing field: {field}"

    def test_version_is_correct(self):
        proof = generate_execution_proof(SAMPLE_CYCLE_DATA)
        assert proof["version"] == TEE_VERSION

    def test_cycle_number_matches_input(self):
        proof = generate_execution_proof(SAMPLE_CYCLE_DATA)
        assert proof["cycle_number"] == 42

    def test_guardian_decision_matches_input(self):
        proof = generate_execution_proof(SAMPLE_CYCLE_DATA)
        assert proof["guardian_decision"] == "approve"

    def test_pcrs_match_simulated_values(self):
        proof = generate_execution_proof(SAMPLE_CYCLE_DATA)
        assert proof["pcrs"] == SIMULATED_PCRS

    def test_attestation_type_is_nitro(self):
        proof = generate_execution_proof(SAMPLE_CYCLE_DATA)
        assert proof["attestation_type"] == "aws-nitro-enclave"

    def test_hashes_are_hex_strings(self):
        proof = generate_execution_proof(SAMPLE_CYCLE_DATA)
        for hash_field in ["inputs_hash", "executor_result_hash", "decision_hash"]:
            h = proof[hash_field]
            assert isinstance(h, str)
            assert len(h) == 64

    def test_hash_chain_has_correct_length(self):
        """5 components: inputs, guardian, executor, agents, meta."""
        proof = generate_execution_proof(SAMPLE_CYCLE_DATA)
        assert len(proof["hash_chain"]["chain"]) == 5

    def test_nonce_is_unique(self):
        proof1 = generate_execution_proof(SAMPLE_CYCLE_DATA)
        proof2 = generate_execution_proof(SAMPLE_CYCLE_DATA)
        assert proof1["nonce"] != proof2["nonce"]

    def test_timestamp_is_reasonable(self):
        import time

        proof = generate_execution_proof(SAMPLE_CYCLE_DATA)
        assert abs(proof["timestamp"] - time.time()) < 1.0

    def test_enclave_id_is_set(self):
        proof = generate_execution_proof(SAMPLE_CYCLE_DATA)
        assert proof["enclave_id"].startswith("apex-enclave-0x")

    def test_empty_cycle_data(self):
        proof = generate_execution_proof({})
        assert proof["cycle_number"] == 0
        assert proof["guardian_decision"] == "unknown"

    def test_vetoed_cycle(self):
        cycle_data = {
            "cycle_number": 10,
            "guardian_decision": "veto",
            "inputs": {},
            "executor_result": {},
        }
        proof = generate_execution_proof(cycle_data)
        assert proof["guardian_decision"] == "veto"
        assert proof["cycle_number"] == 10


class TestVerifyAttestation:
    """Tests for attestation verification."""

    def test_valid_attestation_passes(self):
        proof = generate_execution_proof(SAMPLE_CYCLE_DATA)
        assert verify_attestation(proof) is True

    def test_missing_field_fails(self):
        proof = generate_execution_proof(SAMPLE_CYCLE_DATA)
        del proof["version"]
        assert verify_attestation(proof) is False

    def test_tampered_signature_fails(self):
        proof = generate_execution_proof(SAMPLE_CYCLE_DATA)
        proof["signature"]["signature"] = "0x" + "ff" * 32
        assert verify_attestation(proof) is False

    def test_tampered_pcr_fails(self):
        proof = generate_execution_proof(SAMPLE_CYCLE_DATA)
        proof["pcrs"]["PCR0"] = "tampered"
        assert verify_attestation(proof) is False

    def test_future_timestamp_fails(self):
        proof = generate_execution_proof(SAMPLE_CYCLE_DATA)
        proof["timestamp"] = proof["timestamp"] + 7200  # 2 hours in future
        assert verify_attestation(proof) is False

    def test_empty_dict_fails(self):
        assert verify_attestation({}) is False

    def test_malformed_hash_chain_fails(self):
        proof = generate_execution_proof(SAMPLE_CYCLE_DATA)
        proof["hash_chain"] = {"chain": [], "root_hash": "abc"}
        assert verify_attestation(proof) is False

    def test_missing_signature_field_fails(self):
        proof = generate_execution_proof(SAMPLE_CYCLE_DATA)
        del proof["signature"]["signature"]
        assert verify_attestation(proof) is False

    def test_different_cycle_data_produces_different_proofs(self):
        cycle_a = {
            "cycle_number": 1,
            "inputs": {},
            "guardian_decision": "approve",
            "executor_result": {},
        }
        cycle_b = {
            "cycle_number": 2,
            "inputs": {},
            "guardian_decision": "approve",
            "executor_result": {},
        }
        proof_a = generate_execution_proof(cycle_a)
        proof_b = generate_execution_proof(cycle_b)
        assert proof_a["decision_hash"] != proof_b["decision_hash"]


class TestGenerateAgentProof:
    """Tests for per-agent proof generation."""

    def test_returns_dict_with_required_fields(self):
        proof = generate_agent_proof(1, SAMPLE_CYCLE_DATA)
        required = [
            "version",
            "enclave_id",
            "pcrs",
            "agent_id",
            "nonce",
            "timestamp",
            "cycle_number",
            "agent_decision",
            "agent_hash",
            "hash_chain",
            "signature",
            "attestation_type",
        ]
        for field in required:
            assert field in proof, f"Missing field: {field}"

    def test_agent_id_matches(self):
        proof = generate_agent_proof(2, SAMPLE_CYCLE_DATA)
        assert proof["agent_id"] == 2

    def test_finds_correct_agent_decision(self):
        proof = generate_agent_proof(1, SAMPLE_CYCLE_DATA)
        assert proof["agent_decision"]["agent_id"] == 1
        assert proof["agent_decision"]["role"] == "scout"

    def test_unknown_agent_gets_default_decision(self):
        proof = generate_agent_proof(999, SAMPLE_CYCLE_DATA)
        assert proof["agent_decision"]["decision"] == "no_action"

    def test_agent_hash_is_hex(self):
        proof = generate_agent_proof(1, SAMPLE_CYCLE_DATA)
        assert len(proof["agent_hash"]) == 64

    def test_different_agents_produce_different_proofs(self):
        proof_1 = generate_agent_proof(1, SAMPLE_CYCLE_DATA)
        proof_2 = generate_agent_proof(2, SAMPLE_CYCLE_DATA)
        assert proof_1["agent_hash"] != proof_2["agent_hash"]

    def test_empty_agent_decisions(self):
        cycle_data = {"cycle_number": 5}
        proof = generate_agent_proof(1, cycle_data)
        assert proof["agent_decision"]["decision"] == "no_action"
        assert proof["cycle_number"] == 5


class TestGetTeeStatus:
    """Tests for TEE status reporting."""

    def test_returns_status_dict(self):
        status = get_tee_status()
        assert "status" in status
        assert "version" in status
        assert "enclave_id" in status

    def test_status_is_active(self):
        status = get_tee_status()
        assert status["status"] == "active"

    def test_version_is_correct(self):
        status = get_tee_status()
        assert status["version"] == TEE_VERSION

    def test_has_pcrs(self):
        status = get_tee_status()
        assert status["pcrs"] == SIMULATED_PCRS

    def test_mode_is_simulated_without_key(self):
        status = get_tee_status()
        # Without APEX_ATTESTATION_KEY env var, mode should be simulated
        assert status["mode"] in ("simulated", "production")

    def test_key_configured_flag(self):
        status = get_tee_status()
        assert isinstance(status["key_configured"], bool)
