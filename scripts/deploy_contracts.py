#!/usr/bin/env python3
"""Deploy ERC-8004 Identity + Reputation registries to Base Sepolia."""

import json
import os
import sys

from dotenv import load_dotenv
from eth_account import Account
from web3 import Web3

load_dotenv()

BASE_SEPOLIA_RPC = os.environ.get("BASE_SEPOLIA_RPC", "https://sepolia.base.org")
PRIVATE_KEY = os.environ.get("APEX_PRIVATE_KEY", "")

# ---------------------------------------------------------------------------
# IdentityRegistry ABI (minimal — only what we need post-deployment)
# ---------------------------------------------------------------------------
IDENTITY_REGISTRY_ABI = [
    {"inputs": [], "stateMutability": "nonpayable", "type": "constructor"},
    {
        "anonymous": False,
        "inputs": [
            {
                "indexed": True,
                "internalType": "uint256",
                "name": "agentId",
                "type": "uint256",
            },
            {
                "indexed": False,
                "internalType": "string",
                "name": "agentURI",
                "type": "string",
            },
            {
                "indexed": True,
                "internalType": "address",
                "name": "owner",
                "type": "address",
            },
        ],
        "name": "Registered",
        "type": "event",
    },
    {
        "anonymous": False,
        "inputs": [
            {
                "indexed": True,
                "internalType": "address",
                "name": "from",
                "type": "address",
            },
            {
                "indexed": True,
                "internalType": "address",
                "name": "to",
                "type": "address",
            },
            {
                "indexed": True,
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256",
            },
        ],
        "name": "Transfer",
        "type": "event",
    },
    {
        "inputs": [{"internalType": "string", "name": "agentURI", "type": "string"}],
        "name": "register",
        "outputs": [{"internalType": "uint256", "name": "agentId", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
        "name": "tokenURI",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "uint256", "name": "agentId", "type": "uint256"}],
        "name": "getAgentWallet",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "totalAgents",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "hash", "type": "bytes32"},
            {"internalType": "bytes", "name": "signature", "type": "bytes"},
        ],
        "name": "isValidSignature",
        "outputs": [{"internalType": "bytes4", "name": "magicValue", "type": "bytes4"}],
        "stateMutability": "view",
        "type": "function",
    },
]

# ---------------------------------------------------------------------------
# ReputationRegistry ABI
# ---------------------------------------------------------------------------
REPUTATION_REGISTRY_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "_identityRegistry", "type": "address"}
        ],
        "stateMutability": "nonpayable",
        "type": "constructor",
    },
    {
        "anonymous": False,
        "inputs": [
            {
                "indexed": True,
                "internalType": "uint256",
                "name": "agentId",
                "type": "uint256",
            },
            {
                "indexed": True,
                "internalType": "address",
                "name": "clientAddress",
                "type": "address",
            },
            {
                "indexed": False,
                "internalType": "uint64",
                "name": "feedbackIndex",
                "type": "uint64",
            },
            {
                "indexed": False,
                "internalType": "int128",
                "name": "value",
                "type": "int128",
            },
            {
                "indexed": False,
                "internalType": "uint8",
                "name": "valueDecimals",
                "type": "uint8",
            },
            {
                "indexed": True,
                "internalType": "string",
                "name": "indexedTag1",
                "type": "string",
            },
            {
                "indexed": False,
                "internalType": "string",
                "name": "tag1",
                "type": "string",
            },
            {
                "indexed": False,
                "internalType": "string",
                "name": "tag2",
                "type": "string",
            },
            {
                "indexed": False,
                "internalType": "string",
                "name": "endpoint",
                "type": "string",
            },
            {
                "indexed": False,
                "internalType": "string",
                "name": "feedbackURI",
                "type": "string",
            },
            {
                "indexed": False,
                "internalType": "bytes32",
                "name": "feedbackHash",
                "type": "bytes32",
            },
        ],
        "name": "FeedbackSubmitted",
        "type": "event",
    },
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
    {
        "inputs": [
            {"internalType": "uint256", "name": "agentId", "type": "uint256"},
            {"internalType": "address", "name": "clientAddress", "type": "address"},
            {"internalType": "uint64", "name": "feedbackIndex", "type": "uint64"},
        ],
        "name": "readFeedback",
        "outputs": [
            {"internalType": "int128", "name": "value", "type": "int128"},
            {"internalType": "uint8", "name": "valueDecimals", "type": "uint8"},
            {"internalType": "string", "name": "tag1", "type": "string"},
            {"internalType": "string", "name": "tag2", "type": "string"},
            {"internalType": "bool", "name": "isRevoked", "type": "bool"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "agentId", "type": "uint256"},
            {
                "internalType": "address[]",
                "name": "clientAddresses",
                "type": "address[]",
            },
            {"internalType": "string", "name": "tag1", "type": "string"},
            {"internalType": "string", "name": "tag2", "type": "string"},
        ],
        "name": "getSummary",
        "outputs": [
            {"internalType": "uint64", "name": "count", "type": "uint64"},
            {"internalType": "int128", "name": "summaryValue", "type": "int128"},
            {"internalType": "uint8", "name": "summaryValueDecimals", "type": "uint8"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "uint256", "name": "agentId", "type": "uint256"}],
        "name": "getClients",
        "outputs": [{"internalType": "address[]", "name": "", "type": "address[]"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "name": "feedbackCount",
        "outputs": [{"internalType": "uint64", "name": "", "type": "uint64"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "identityRegistry",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
]

# ---------------------------------------------------------------------------
# Pre-compiled bytecode from forge build
# ---------------------------------------------------------------------------
# These get populated by reading the forge build artifacts
IDENTITY_REGISTRY_BYTECODE = ""
IDENTITY_REGISTRY_DEPLOY_BYTECODE = ""
REPUTATION_REGISTRY_BYTECODE = ""
RISK_ROUTER_BYTECODE = ""

# ---------------------------------------------------------------------------
# RiskRouter ABI
# ---------------------------------------------------------------------------
RISK_ROUTER_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "_identityRegistry", "type": "address"},
            {
                "internalType": "uint256",
                "name": "_initialVaultBalance",
                "type": "uint256",
            },
        ],
        "stateMutability": "nonpayable",
        "type": "constructor",
    },
    {
        "anonymous": False,
        "inputs": [
            {
                "indexed": True,
                "internalType": "address",
                "name": "agentWallet",
                "type": "address",
            },
            {
                "indexed": True,
                "internalType": "uint256",
                "name": "agentId",
                "type": "uint256",
            },
            {
                "indexed": False,
                "internalType": "string",
                "name": "protocol",
                "type": "string",
            },
            {
                "indexed": False,
                "internalType": "string",
                "name": "pool",
                "type": "string",
            },
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "amountUsd",
                "type": "uint256",
            },
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "leverage",
                "type": "uint256",
            },
            {
                "indexed": False,
                "internalType": "bytes32",
                "name": "intentHash",
                "type": "bytes32",
            },
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "timestamp",
                "type": "uint256",
            },
        ],
        "name": "TradeExecuted",
        "type": "event",
    },
    {
        "anonymous": False,
        "inputs": [
            {
                "indexed": True,
                "internalType": "address",
                "name": "agentWallet",
                "type": "address",
            },
            {
                "indexed": True,
                "internalType": "uint256",
                "name": "agentId",
                "type": "uint256",
            },
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "dailyLoss",
                "type": "uint256",
            },
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "dailyLossLimit",
                "type": "uint256",
            },
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "timestamp",
                "type": "uint256",
            },
        ],
        "name": "DailyLossLimitHit",
        "type": "event",
    },
    {
        "anonymous": False,
        "inputs": [
            {
                "indexed": True,
                "internalType": "address",
                "name": "agentWallet",
                "type": "address",
            },
            {
                "indexed": True,
                "internalType": "uint256",
                "name": "agentId",
                "type": "uint256",
            },
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "requestedAmount",
                "type": "uint256",
            },
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "maxAllowed",
                "type": "uint256",
            },
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "timestamp",
                "type": "uint256",
            },
        ],
        "name": "PositionSizeExceeded",
        "type": "event",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "agentId", "type": "uint256"},
            {"internalType": "string", "name": "protocol", "type": "string"},
            {"internalType": "string", "name": "pool", "type": "string"},
            {"internalType": "uint256", "name": "amountUsd", "type": "uint256"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"},
            {"internalType": "uint256", "name": "nonce", "type": "uint256"},
            {"internalType": "uint256", "name": "leverage", "type": "uint256"},
            {"internalType": "bytes", "name": "signature", "type": "bytes"},
        ],
        "name": "submitTradeIntent",
        "outputs": [{"internalType": "bool", "name": "approved", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "agentWallet", "type": "address"}
        ],
        "name": "dailyLoss",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "agentWallet", "type": "address"}
        ],
        "name": "dailyLossLimit",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "vaultBalance",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "identityRegistry",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "agentWallet", "type": "address"},
            {"internalType": "bool", "name": "authorized", "type": "bool"},
        ],
        "name": "setAgentAuthorized",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "agentWallet", "type": "address"},
            {"internalType": "uint256", "name": "limit", "type": "uint256"},
        ],
        "name": "setDailyLossLimit",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "string", "name": "protocol", "type": "string"},
            {"internalType": "bool", "name": "whitelisted", "type": "bool"},
        ],
        "name": "setProtocolWhitelisted",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "newBalance", "type": "uint256"}
        ],
        "name": "setVaultBalance",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "agentWallet", "type": "address"}
        ],
        "name": "remainingDailyLoss",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "maxPositionSize",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]


def _load_artifact(path: str) -> dict:
    """Load a forge build artifact."""
    with open(path) as f:
        return json.load(f)


def _load_bytecode():
    """Load compiled bytecode from forge artifacts."""
    global \
        IDENTITY_REGISTRY_DEPLOY_BYTECODE, \
        REPUTATION_REGISTRY_BYTECODE, \
        RISK_ROUTER_BYTECODE

    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    artifact_dir = os.path.join(project_root, "contracts", "out")

    try:
        id_artifact = _load_artifact(
            os.path.join(artifact_dir, "IdentityRegistry.sol", "IdentityRegistry.json")
        )
        IDENTITY_REGISTRY_DEPLOY_BYTECODE = id_artifact["bytecode"]["object"]

        rep_artifact = _load_artifact(
            os.path.join(
                artifact_dir, "ReputationRegistry.sol", "ReputationRegistry.json"
            )
        )
        REPUTATION_REGISTRY_BYTECODE = rep_artifact["bytecode"]["object"]

        router_artifact = _load_artifact(
            os.path.join(artifact_dir, "RiskRouter.sol", "RiskRouter.json")
        )
        RISK_ROUTER_BYTECODE = router_artifact["bytecode"]["object"]
    except Exception as e:
        print(f"Warning: Could not load forge artifacts ({e})")
        print("You need to run: cd contracts && forge build")
        sys.exit(1)


def deploy_contract(
    w3: Web3, account: Account, bytecode: str, abi: list, nonce: int, args: list = None
) -> tuple:
    """Deploy a contract and return (address, tx_hash)."""
    if args:
        contract = w3.eth.contract(abi=abi, bytecode=bytecode)
        tx = contract.constructor(*args).build_transaction(
            {
                "from": account.address,
                "nonce": nonce,
                "gas": 3_000_000,
                "gasPrice": w3.eth.gas_price,
            }
        )
    else:
        contract = w3.eth.contract(abi=abi, bytecode=bytecode)
        tx = contract.constructor().build_transaction(
            {
                "from": account.address,
                "nonce": nonce,
                "gas": 3_000_000,
                "gasPrice": w3.eth.gas_price,
            }
        )

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

    return receipt.contractAddress, tx_hash.hex()


def main():
    if not PRIVATE_KEY or PRIVATE_KEY.startswith("0x0000"):
        print("ERROR: APEX_PRIVATE_KEY not set or is placeholder in .env")
        print("Update your .env with your real private key, then re-run.")
        sys.exit(1)

    _load_bytecode()

    w3 = Web3(Web3.HTTPProvider(BASE_SEPOLIA_RPC))
    if not w3.is_connected():
        print(f"ERROR: Cannot connect to Base Sepolia RPC at {BASE_SEPOLIA_RPC}")
        sys.exit(1)

    account = Account.from_key(PRIVATE_KEY)
    balance = w3.eth.get_balance(account.address)
    print(f"Using wallet: {account.address}")
    print(f"Balance: {w3.from_wei(balance, 'ether')} ETH")
    print(f"Chain ID: {w3.eth.chain_id}")
    print()

    # 1. Deploy IdentityRegistry
    print("Deploying IdentityRegistry...")
    id_address, id_tx = deploy_contract(
        w3, account, IDENTITY_REGISTRY_DEPLOY_BYTECODE, IDENTITY_REGISTRY_ABI
    )
    print(f"  IdentityRegistry deployed at: {id_address}")
    print(f"  TX: {id_tx}")
    print()

    # 2. Deploy ReputationRegistry (linked to IdentityRegistry)
    print("Deploying ReputationRegistry...")
    rep_address, rep_tx = deploy_contract(
        w3,
        account,
        REPUTATION_REGISTRY_BYTECODE,
        REPUTATION_REGISTRY_ABI,
        args=[id_address],
    )
    print(f"  ReputationRegistry deployed at: {rep_address}")
    print(f"  TX: {rep_tx}")
    print()

    # 3. Verify ReputationRegistry points to correct IdentityRegistry
    rep_contract = w3.eth.contract(address=rep_address, abi=REPUTATION_REGISTRY_ABI)
    linked_id = rep_contract.functions.identityRegistry().call()
    assert linked_id.lower() == id_address.lower(), (
        "ReputationRegistry not linked correctly!"
    )
    print(f"  Verified: ReputationRegistry.identityRegistry() = {linked_id}")
    print()

    # 3. Deploy RiskRouter (linked to IdentityRegistry)
    INITIAL_VAULT_BALANCE = (
        int(os.environ.get("INITIAL_VAULT_BALANCE", "1000000")) * 10**18
    )
    print("Deploying RiskRouter...")
    router_address, router_tx = deploy_contract(
        w3,
        account,
        RISK_ROUTER_BYTECODE,
        RISK_ROUTER_ABI,
        nonce=w3.eth.get_transaction_count(account.address),
        args=[id_address, INITIAL_VAULT_BALANCE],
    )
    print(f"  RiskRouter deployed at: {router_address}")
    print(f"  TX: {router_tx}")
    print()

    # 4. Verify RiskRouter points to correct IdentityRegistry
    router_contract = w3.eth.contract(address=router_address, abi=RISK_ROUTER_ABI)
    linked_registry = router_contract.functions.identityRegistry().call()
    assert linked_registry.lower() == id_address.lower(), (
        "RiskRouter not linked correctly!"
    )
    print(f"  Verified: RiskRouter.identityRegistry() = {linked_registry}")
    print()

    # 5. Update .env and agents.json
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(project_root, ".env")

    # Read existing .env
    env_lines = []
    if os.path.exists(env_path):
        with open(env_path) as f:
            env_lines = f.readlines()

    # Update or add registry addresses
    updated = False
    for i, line in enumerate(env_lines):
        if line.startswith("IDENTITY_REGISTRY_ADDRESS="):
            env_lines[i] = f"IDENTITY_REGISTRY_ADDRESS={id_address}\n"
            updated = True
        elif line.startswith("REPUTATION_REGISTRY_ADDRESS="):
            env_lines[i] = f"REPUTATION_REGISTRY_ADDRESS={rep_address}\n"
            updated = True
        elif line.startswith("RISK_ROUTER_ADDRESS="):
            env_lines[i] = f"RISK_ROUTER_ADDRESS={router_address}\n"
            updated = True

    if not updated:
        env_lines.append(f"\nIDENTITY_REGISTRY_ADDRESS={id_address}\n")
        env_lines.append(f"REPUTATION_REGISTRY_ADDRESS={rep_address}\n")
        env_lines.append(f"RISK_ROUTER_ADDRESS={router_address}\n")

    with open(env_path, "w") as f:
        f.writelines(env_lines)
    print(f"Updated {env_path}")

    # Write contract addresses to a JSON file for easy reference
    addresses = {
        "identity_registry": id_address,
        "reputation_registry": rep_address,
        "risk_router": router_address,
        "network": "base-sepolia",
        "chain_id": 84532,
        "deployer": account.address,
    }
    addr_path = os.path.join(project_root, "contracts", "addresses.json")
    with open(addr_path, "w") as f:
        json.dump(addresses, f, indent=2)
    print(f"Written addresses to {addr_path}")

    print()
    print("Done! Contract addresses:")
    print(f"  IdentityRegistry:    {id_address}")
    print(f"  ReputationRegistry:  {rep_address}")
    print(f"  RiskRouter:          {router_address}")
    print()
    print("Next: run 'python scripts/register_agents.py' to mint agent identities.")


if __name__ == "__main__":
    main()
