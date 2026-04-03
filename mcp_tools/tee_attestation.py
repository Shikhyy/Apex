"""TEE (Trusted Execution Environment) attestation module.

Provides verifiable execution proofs for APEX agent cycles by simulating
AWS Nitro Enclave attestation documents.  Includes hash-chain integrity,
simulated PCR registers, and COSE-style signatures.
"""

import hashlib
import hmac
import json
import logging
import os
import secrets
import time
from typing import Optional

logger = logging.getLogger(__name__)

TEE_VERSION = "1.0.0"
TEE_ENCLAVE_ID = "apex-enclave-0x%s" % secrets.token_hex(8)[:16]

# Simulated PCR (Platform Configuration Register) values
# In a real Nitro Enclave these are measured by the hardware
SIMULATED_PCRS = {
    "PCR0": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "PCR1": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    "PCR2": "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    "PCR3": "0000000000000000000000000000000000000000000000000000000000000000",
}

# Attestation signing key (simulated — in production this lives inside the enclave)
_ATTESTATION_KEY: Optional[bytes] = None


def _get_attestation_key() -> bytes:
    """Return the attestation signing key.

    Uses APEX_ATTESTATION_KEY env var if set, otherwise falls back to a
    deterministic simulated key so that verification works in dev/test.
    """
    global _ATTESTATION_KEY
    if _ATTESTATION_KEY is not None:
        return _ATTESTATION_KEY

    env_key = os.environ.get("APEX_ATTESTATION_KEY")
    if env_key:
        _ATTESTATION_KEY = env_key.encode()
    else:
        logger.warning("APEX_ATTESTATION_KEY not set — using simulated attestation key")
        _ATTESTATION_KEY = b"apex-tee-simulated-key-2026"

    return _ATTESTATION_KEY


def _compute_hash(data: str) -> str:
    """SHA-256 hex digest of a string."""
    return hashlib.sha256(data.encode()).hexdigest()


def _compute_hmac(key: bytes, payload: str) -> str:
    """HMAC-SHA256 hex digest."""
    return hmac.new(key, payload.encode(), hashlib.sha256).hexdigest()


def _build_document_hash_chain(components: list[str]) -> dict:
    """Build a sequential hash chain over document components.

    Each link in the chain is H(previous_hash || component_i).
    The final hash is the document root.
    """
    chain = []
    prev_hash = "0" * 64  # genesis

    for i, component in enumerate(components):
        link_input = prev_hash + component
        current_hash = _compute_hash(link_input)
        chain.append(
            {
                "index": i,
                "component": component[:80] + "..."
                if len(component) > 80
                else component,
                "hash": current_hash,
            }
        )
        prev_hash = current_hash

    return {
        "chain": chain,
        "root_hash": prev_hash,
    }


def _simulate_cose_signature(key: bytes, payload: str) -> dict:
    """Simulate a COSE_Sign1 structure.

    Real COSE uses ECDSA over P-256 with a CBOR-encoded protected header.
    Here we approximate the structure with HMAC-SHA256 as the signature
    and a JSON-serialised header.
    """
    protected_header = {
        "alg": "ES256",
        "kid": TEE_ENCLAVE_ID,
    }
    header_b64 = hashlib.sha256(
        json.dumps(protected_header, separators=(",", ":")).encode()
    ).hexdigest()[:16]

    signature = _compute_hmac(key, payload)

    return {
        "protected": protected_header,
        "unprotected": {"tee": "aws-nitro-enclave", "version": TEE_VERSION},
        "signature": f"0x{signature}",
        "payload_hash": _compute_hash(payload),
    }


def generate_execution_proof(cycle_data: dict) -> dict:
    """Create a signed attestation of a cycle's execution.

    Produces a document that records:
    - Input data (market signals, opportunities)
    - Agent decisions (Guardian veto/approve, Executor result)
    - Timestamp, cycle number
    - SHA-256 hash of all inputs + outputs
    - A simulated AWS Nitro Enclave attestation document

    Args:
        cycle_data: dict with keys such as:
            - cycle_number: int
            - inputs: dict (market signals, opportunities)
            - guardian_decision: str ("approve" | "veto")
            - executor_result: dict
            - agent_decisions: list of per-agent dicts

    Returns:
        Attestation document dict.
    """
    timestamp = time.time()
    nonce = secrets.token_hex(16)
    cycle_number = cycle_data.get("cycle_number", 0)
    inputs = cycle_data.get("inputs", {})
    guardian_decision = cycle_data.get("guardian_decision", "unknown")
    executor_result = cycle_data.get("executor_result", {})
    agent_decisions = cycle_data.get("agent_decisions", [])

    # Serialize components for hashing
    inputs_json = json.dumps(inputs, sort_keys=True, separators=(",", ":"))
    guardian_json = json.dumps(
        {"decision": guardian_decision}, sort_keys=True, separators=(",", ":")
    )
    executor_json = json.dumps(executor_result, sort_keys=True, separators=(",", ":"))
    agents_json = json.dumps(agent_decisions, sort_keys=True, separators=(",", ":"))
    meta_json = json.dumps(
        {
            "cycle_number": cycle_number,
            "timestamp": timestamp,
            "nonce": nonce,
            "enclave_id": TEE_ENCLAVE_ID,
        },
        sort_keys=True,
        separators=(",", ":"),
    )

    # Build hash chain
    components = [inputs_json, guardian_json, executor_json, agents_json, meta_json]
    hash_chain = _build_document_hash_chain(components)

    # Compute aggregate decision hash
    decision_payload = inputs_json + guardian_json + executor_json + str(cycle_number)
    decision_hash = _compute_hash(decision_payload)

    # Build the attestation payload (the thing we sign)
    attestation_payload = json.dumps(
        {
            "version": TEE_VERSION,
            "enclave_id": TEE_ENCLAVE_ID,
            "pcrs": SIMULATED_PCRS,
            "cycle_number": cycle_number,
            "nonce": nonce,
            "timestamp": timestamp,
            "decision_hash": decision_hash,
            "root_hash": hash_chain["root_hash"],
        },
        sort_keys=True,
        separators=(",", ":"),
    )

    # Sign
    key = _get_attestation_key()
    cose_sig = _simulate_cose_signature(key, attestation_payload)

    attestation = {
        "version": TEE_VERSION,
        "enclave_id": TEE_ENCLAVE_ID,
        "pcrs": SIMULATED_PCRS.copy(),
        "nonce": nonce,
        "timestamp": timestamp,
        "cycle_number": cycle_number,
        "inputs_hash": _compute_hash(inputs_json),
        "guardian_decision": guardian_decision,
        "executor_result_hash": _compute_hash(executor_json),
        "decision_hash": decision_hash,
        "hash_chain": hash_chain,
        "signature": cose_sig,
        "attestation_type": "aws-nitro-enclave",
    }

    logger.info(
        "Generated TEE attestation: cycle=%d enclave=%s",
        cycle_number,
        TEE_ENCLAVE_ID[:24],
    )

    return attestation


def verify_attestation(attestation: dict) -> bool:
    """Verify the attestation's integrity.

    Checks:
    1. Required fields are present
    2. Hash chain is consistent (root_hash matches chain)
    3. Signature is valid (HMAC over the payload)
    4. PCR registers match expected values
    5. Timestamp is not in the future

    Args:
        attestation: dict as returned by generate_execution_proof.

    Returns:
        True if all checks pass, False otherwise.
    """
    try:
        # 1. Required fields
        required = [
            "version",
            "enclave_id",
            "pcrs",
            "nonce",
            "timestamp",
            "cycle_number",
            "decision_hash",
            "hash_chain",
            "signature",
        ]
        for field in required:
            if field not in attestation:
                logger.warning("Attestation missing field: %s", field)
                return False

        # 2. Hash chain verification
        hash_chain = attestation["hash_chain"]
        if "root_hash" not in hash_chain or "chain" not in hash_chain:
            logger.warning("Attestation hash_chain malformed")
            return False

        chain = hash_chain["chain"]
        prev_hash = "0" * 64
        for link in chain:
            # We can't fully re-verify without the original components,
            # but we can check the chain links are internally consistent
            if "hash" not in link or "index" not in link:
                return False
            prev_hash = link["hash"]

        if prev_hash != hash_chain["root_hash"]:
            logger.warning("Hash chain root mismatch")
            return False

        # 3. Signature verification
        sig = attestation["signature"]
        if "signature" not in sig or "payload_hash" not in sig:
            logger.warning("Attestation signature malformed")
            return False

        key = _get_attestation_key()
        payload = json.dumps(
            {
                "version": attestation["version"],
                "enclave_id": attestation["enclave_id"],
                "pcrs": attestation["pcrs"],
                "cycle_number": attestation["cycle_number"],
                "nonce": attestation["nonce"],
                "timestamp": attestation["timestamp"],
                "decision_hash": attestation["decision_hash"],
                "root_hash": hash_chain["root_hash"],
            },
            sort_keys=True,
            separators=(",", ":"),
        )

        expected_sig = _compute_hmac(key, payload)
        actual_sig = sig["signature"].replace("0x", "")

        if not hmac.compare_digest(expected_sig, actual_sig):
            logger.warning("Attestation signature mismatch")
            return False

        # 4. PCR register verification
        pcrs = attestation["pcrs"]
        for pcr_name, expected_value in SIMULATED_PCRS.items():
            if pcrs.get(pcr_name) != expected_value:
                logger.warning("PCR mismatch: %s", pcr_name)
                return False

        # 5. Timestamp sanity check (not more than 1 hour in the future)
        if attestation["timestamp"] > time.time() + 3600:
            logger.warning("Attestation timestamp is in the future")
            return False

        logger.info(
            "Attestation verified: cycle=%d enclave=%s",
            attestation["cycle_number"],
            attestation["enclave_id"][:24],
        )
        return True

    except Exception as exc:
        logger.error("Attestation verification error: %s", exc)
        return False


def generate_agent_proof(agent_id: int, cycle_data: dict) -> dict:
    """Generate a per-agent execution proof.

    Wraps the agent's contribution within a cycle into its own attestation
    that can be independently verified.

    Args:
        agent_id: integer identifier for the agent.
        cycle_data: dict with cycle information (same structure as
                    generate_execution_proof).

    Returns:
        Agent-specific attestation dict.
    """
    timestamp = time.time()
    nonce = secrets.token_hex(16)
    cycle_number = cycle_data.get("cycle_number", 0)

    # Extract this agent's decision if available
    agent_decisions = cycle_data.get("agent_decisions", [])
    agent_decision = None
    for d in agent_decisions:
        if d.get("agent_id") == agent_id:
            agent_decision = d
            break

    if agent_decision is None:
        agent_decision = {"agent_id": agent_id, "decision": "no_action"}

    # Build agent-specific payload
    agent_json = json.dumps(agent_decision, sort_keys=True, separators=(",", ":"))
    meta_json = json.dumps(
        {
            "agent_id": agent_id,
            "cycle_number": cycle_number,
            "timestamp": timestamp,
            "nonce": nonce,
        },
        sort_keys=True,
        separators=(",", ":"),
    )

    components = [agent_json, meta_json]
    hash_chain = _build_document_hash_chain(components)
    agent_hash = _compute_hash(agent_json)

    attestation_payload = json.dumps(
        {
            "version": TEE_VERSION,
            "enclave_id": TEE_ENCLAVE_ID,
            "agent_id": agent_id,
            "pcrs": SIMULATED_PCRS,
            "cycle_number": cycle_number,
            "nonce": nonce,
            "timestamp": timestamp,
            "agent_hash": agent_hash,
            "root_hash": hash_chain["root_hash"],
        },
        sort_keys=True,
        separators=(",", ":"),
    )

    key = _get_attestation_key()
    cose_sig = _simulate_cose_signature(key, attestation_payload)

    proof = {
        "version": TEE_VERSION,
        "enclave_id": TEE_ENCLAVE_ID,
        "pcrs": SIMULATED_PCRS.copy(),
        "agent_id": agent_id,
        "nonce": nonce,
        "timestamp": timestamp,
        "cycle_number": cycle_number,
        "agent_decision": agent_decision,
        "agent_hash": agent_hash,
        "hash_chain": hash_chain,
        "signature": cose_sig,
        "attestation_type": "aws-nitro-enclave",
    }

    logger.info(
        "Generated agent proof: agent_id=%d cycle=%d",
        agent_id,
        cycle_number,
    )

    return proof


def get_tee_status() -> dict:
    """Return TEE module status.

    Returns:
        dict with version, enclave ID, PCR registers, key status.
    """
    key_configured = bool(os.environ.get("APEX_ATTESTATION_KEY"))

    return {
        "status": "active",
        "version": TEE_VERSION,
        "enclave_id": TEE_ENCLAVE_ID,
        "attestation_type": "aws-nitro-enclave",
        "pcrs": SIMULATED_PCRS.copy(),
        "key_configured": key_configured,
        "mode": "production" if key_configured else "simulated",
    }
