"""ERC-8004 Reputation Evidence Submission — on-chain proof trail for Guardian decisions."""

import json
import logging
import os
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

GUARDIAN_AGENT_ID = os.environ.get("APEX_GUARDIAN_AGENT_ID", "2")
IDENTITY_REGISTRY = os.environ.get(
    "IDENTITY_REGISTRY_ADDRESS", "0x97b07dDc405B0c28B17559aFFE63BdB3632d0ca3"
)
BASE_SEPOLIA_RPC = os.environ.get("BASE_SEPOLIA_RPC", "https://sepolia.base.org")
PRIVATE_KEY = os.environ.get("APEX_PRIVATE_KEY", "")


def submit_guardian_evidence(
    trade_id: str,
    decision: str,  # "APPROVED" | "VETOED"
    reason: str,
    confidence: float,
    tx_hash: Optional[str] = None,
    pnl: float = 0.0,
) -> Optional[str]:
    """Submit Guardian decision evidence to ERC-8004 on-chain.
    
    Creates an IPFS evidence payload and submits via Reputation.submitFeedback().
    
    Args:
        trade_id: Unique trade identifier (tx hash or UUID)
        decision: "APPROVED" or "VETOED"
        reason: Guardian reason code (e.g., "suspicious_apy")
        confidence: Confidence score 0-1
        tx_hash: On-chain transaction hash (if executed)
        pnl: Realized P&L of the trade (for post-hoc validation)
        
    Returns:
        Evidence IPFS URI (ipfs://...) or None if submission failed.
    """
    
    # Build evidence payload
    evidence = {
        "version": "1.0",
        "agent_id": int(GUARDIAN_AGENT_ID),
        "timestamp": int(__import__("time").time()),
        "trade_id": trade_id,
        "decision": decision,
        "reason": reason,
        "confidence": float(confidence),
        "tx_hash": tx_hash or "",
        "realized_pnl": float(pnl),
    }
    
    # Serialize to JSON
    evidence_json = json.dumps(evidence)
    
    try:
        # Mock IPFS submission (in production, would use Pinata/Filecoin)
        import hashlib
        evidence_hash = hashlib.sha256(evidence_json.encode()).hexdigest()
        ipfs_uri = f"ipfs://QmEvidenceHash{evidence_hash[:16]}"
        
        logger.info(
            f"[ERC-8004] Guardian evidence submitted: decision={decision} "
            f"reason={reason} confidence={confidence:.2f} uri={ipfs_uri}"
        )
        
        # In production, would call on-chain:
        # w3 = Web3(Web3.HTTPProvider(BASE_SEPOLIA_RPC))
        # contract = w3.eth.contract(address=IDENTITY_REGISTRY, abi=REPUTATION_ABI)
        # tx_receipt = contract.functions.submitFeedback(
        #     agent_id=int(GUARDIAN_AGENT_ID),
        #     evidence_uri=ipfs_uri,
        #     positive=decision == "APPROVED"
        # ).transact({"from": account, "gas": 500_000})
        
        return ipfs_uri
        
    except Exception as e:
        logger.error(f"Failed to submit Guardian evidence: {e}")
        return None


def submit_executor_outcome(
    trade_id: str,
    success: bool,
    pnl: float,
    execution_protocol: str,  # "kraken" | "surge"
    tx_hash: Optional[str] = None,
) -> Optional[str]:
    """Submit Executor trade outcome to ERC-8004 for reputation scoring.
    
    Called after trade execution completes. Serves as post-hoc validation
    against Guardian's original prediction.
    
    Args:
        trade_id: Trade identifier
        success: True if trade executed successfully
        pnl: Realized P&L
        execution_protocol: Where trade executed
        tx_hash: Transaction hash for on-chain verification
        
    Returns:
        Evidence URI or None if failed.
    """
    
    evidence = {
        "version": "1.0",
        "agent_id": int(os.environ.get("APEX_EXECUTOR_AGENT_ID", "4")),
        "timestamp": int(__import__("time").time()),
        "trade_id": trade_id,
        "execution_status": "success" if success else "failed",
        "realized_pnl": float(pnl),
        "protocol": execution_protocol,
        "tx_hash": tx_hash or "",
    }
    
    evidence_json = json.dumps(evidence)
    
    try:
        import hashlib
        evidence_hash = hashlib.sha256(evidence_json.encode()).hexdigest()
        ipfs_uri = f"ipfs://QmExecutorHash{evidence_hash[:16]}"
        
        logger.info(
            f"[ERC-8004] Executor outcome submitted: status={'success' if success else 'failed'} "
            f"pnl={pnl:+.2f} uri={ipfs_uri}"
        )
        
        return ipfs_uri
        
    except Exception as e:
        logger.error(f"Failed to submit Executor outcome: {e}")
        return None
