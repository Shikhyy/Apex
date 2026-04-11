"""ERC-8004 shared skills — reputation signals and agent card management."""

import logging
import json
import os
import base64
from typing import Any

import httpx
from dotenv import load_dotenv
from eth_account import Account
from web3 import Web3

logger = logging.getLogger(__name__)

load_dotenv()

BASE_SEPOLIA_RPC = os.environ.get("BASE_SEPOLIA_RPC", "https://sepolia.base.org")
PRIVATE_KEY = os.environ.get("APEX_PRIVATE_KEY", "")
PINATA_JWT = os.environ.get("PINATA_JWT", "")
REPUTATION_REGISTRY_ADDRESS = os.environ.get(
    "REPUTATION_REGISTRY_ADDRESS",
    "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
)
IDENTITY_REGISTRY_ADDRESS = os.environ.get(
    "IDENTITY_REGISTRY_ADDRESS",
    "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
)


def _get_w3() -> Web3:
    return Web3(Web3.HTTPProvider(BASE_SEPOLIA_RPC))


def _get_account() -> Account:
    return Account.from_key(PRIVATE_KEY)


def upload_to_ipfs(payload: dict) -> str:
    """Upload JSON payload to Pinata IPFS and return ipfs:// URI."""
    if not PINATA_JWT:
        encoded = base64.b64encode(json.dumps(payload).encode()).decode()
        return f"data:application/json;base64,{encoded}"

    url = "https://api.pinata.cloud/pinning/pinJSONToIPFS"
    headers = {
        "Authorization": f"Bearer {PINATA_JWT}",
        "Content-Type": "application/json",
    }
    resp = httpx.post(url, json=payload, headers=headers, timeout=30)
    resp.raise_for_status()
    ipfs_hash = resp.json()["IpfsHash"]
    return f"ipfs://{ipfs_hash}"


async def post_reputation_signal(
    reviewer_agent_id: int,
    subject_agent_id: int,
    decision: str,
    reason: str,
    detail: str,
    confidence: float,
    evidence: dict,
) -> dict[str, Any]:
    """Post a feedback entry to the ERC-8004 Reputation Registry on Base Sepolia."""
    evidence_uri = upload_to_ipfs(evidence)
    score = int(confidence * 100) if decision == "APPROVED" else 0

    if not PRIVATE_KEY:
        return {
            "tx_hash": "0x" + "0" * 64,
            "evidence_uri": evidence_uri,
            "score": score,
        }

    w3 = _get_w3()
    account = _get_account()

    abi = [
        {
            "inputs": [
                {"internalType": "uint256", "name": "agentId", "type": "uint256"},
                {"internalType": "int128", "name": "value", "type": "int128"},
                {"internalType": "uint8", "name": "valueDecimals", "type": "uint8"},
                {"internalType": "string", "name": "tag1", "type": "string"},
                {"internalType": "string", "name": "tag2", "type": "string"},
                {"internalType": "string", "name": "endpoint", "type": "string"},
                {"internalType": "string", "name": "feedbackURI", "type": "string"},
                {"internalType": "bytes32", "name": "feedbackHash", "type": "bytes32"},
            ],
            "name": "giveFeedback",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function",
        },
    ]

    contract = w3.eth.contract(
        address=Web3.to_checksum_address(REPUTATION_REGISTRY_ADDRESS),
        abi=abi,
    )

    nonce = w3.eth.get_transaction_count(account.address, "pending")
    feedback_hash = Web3.keccak(text=evidence_uri)
    tx = contract.functions.giveFeedback(
        subject_agent_id,
        int(score),
        0,
        decision,
        reason,
        "",
        evidence_uri,
        feedback_hash,
    ).build_transaction(
        {
            "from": account.address,
            "nonce": nonce,
            "gas": 300_000,
            "gasPrice": w3.eth.gas_price,
        }
    )

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)

    return {
        "tx_hash": tx_hash.hex(),
        "evidence_uri": evidence_uri,
        "score": score,
        "block": receipt.blockNumber,
    }


async def get_agent_card(agent_id: int) -> dict[str, Any]:
    """Fetch an agent's AgentCard from the ERC-8004 Identity Registry."""
    w3 = _get_w3()

    abi = [
        {
            "inputs": [
                {"internalType": "uint256", "name": "tokenId", "type": "uint256"}
            ],
            "name": "tokenURI",
            "outputs": [{"internalType": "string", "name": "", "type": "string"}],
            "stateMutability": "view",
            "type": "function",
        },
    ]

    contract = w3.eth.contract(
        address=Web3.to_checksum_address(IDENTITY_REGISTRY_ADDRESS),
        abi=abi,
    )

    try:
        uri = contract.functions.tokenURI(agent_id).call()
        if uri.startswith("ipfs://"):
            ipfs_hash = uri.replace("ipfs://", "")
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"https://gateway.pinata.cloud/ipfs/{ipfs_hash}"
                )
                resp.raise_for_status()
                return resp.json()
        elif uri.startswith("data:"):
            encoded = uri.split(",")[1]
            return json.loads(base64.b64decode(encoded))
    except Exception as e:
        logger.warning("Failed to fetch agent card for agent_id=%d: %s", agent_id, e)

    return {"name": f"agent-{agent_id}", "active": False}
