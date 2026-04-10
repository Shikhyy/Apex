#!/usr/bin/env python3
"""Deploy RiskRouter registry exclusively to Base Sepolia to preserve Identity."""

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
            {"internalType": "address", "name": "agentWallet", "type": "address"},
            {"internalType": "uint256", "name": "profitUsd", "type": "uint256"},
        ],
        "name": "recordProfit",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    }
]

RISK_ROUTER_BYTECODE = ""

def _load_artifact(path: str) -> dict:
    with open(path) as f:
        return json.load(f)

def _load_bytecode():
    global RISK_ROUTER_BYTECODE
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    artifact_dir = os.path.join(project_root, "contracts", "out")
    try:
        router_artifact = _load_artifact(os.path.join(artifact_dir, "RiskRouter.sol", "RiskRouter.json"))
        RISK_ROUTER_BYTECODE = router_artifact["bytecode"]["object"]
    except Exception as e:
        print(f"Warning: Could not load forge artifacts ({e})")
        print("You need to run: cd contracts && forge build")
        sys.exit(1)

def deploy_contract(w3: Web3, account: Account, bytecode: str, abi: list, nonce: int, args: list = None) -> tuple:
    contract = w3.eth.contract(abi=abi, bytecode=bytecode)
    tx = contract.constructor(*args).build_transaction({
        "from": account.address,
        "nonce": nonce,
        "gas": 3_500_000,
        "gasPrice": w3.eth.gas_price,
    })
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    return receipt.contractAddress, tx_hash.hex()

def main():
    if not PRIVATE_KEY or PRIVATE_KEY.startswith("0x0000"):
        print("ERROR: APEX_PRIVATE_KEY not set or is placeholder")
        sys.exit(1)

    # Need the identity registry
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    addr_path = os.path.join(project_root, "contracts", "addresses.json")
    if not os.path.exists(addr_path):
        print("ERROR: contracts/addresses.json not found")
        sys.exit(1)
        
    with open(addr_path) as f:
        addresses = json.load(f)
    if "identity_registry" not in addresses:
        print("ERROR: identity_registry missing from addresses.json")
        sys.exit(1)

    id_address = addresses["identity_registry"]

    _load_bytecode()

    w3 = Web3(Web3.HTTPProvider(BASE_SEPOLIA_RPC))
    if not w3.is_connected():
        print("ERROR: Cannot connect to Base Sepolia RPC")
        sys.exit(1)

    account = Account.from_key(PRIVATE_KEY)

    print(f"Deploying RiskRouter using IdentityRegistry: {id_address}")
    deploy_nonce = w3.eth.get_transaction_count(account.address, "pending")
    INITIAL_VAULT_BALANCE = 1000000 * 10**18
    router_address, router_tx = deploy_contract(
        w3, account, RISK_ROUTER_BYTECODE, RISK_ROUTER_ABI,
        nonce=deploy_nonce,
        args=[id_address, INITIAL_VAULT_BALANCE]
    )
    
    print(f"Deployed at: {router_address} TX: {router_tx}")
    
    # Authorizing the wallet
    router_contract = w3.eth.contract(address=router_address, abi=RISK_ROUTER_ABI)
    auth_nonce = deploy_nonce + 1
    tx = router_contract.functions.setAgentAuthorized(account.address, True).build_transaction({
        "from": account.address,
        "nonce": auth_nonce,
        "gas": 150_000,
        "gasPrice": w3.eth.gas_price,
    })
    signed = account.sign_transaction(tx)
    set_tx = w3.eth.send_raw_transaction(signed.raw_transaction)
    w3.eth.wait_for_transaction_receipt(set_tx, timeout=120)
    print("Authorized main wallet for trading.")
    
    # Adding to addresses.json
    addresses["risk_router"] = router_address
    with open(addr_path, "w") as f:
         json.dump(addresses, f, indent=2)

    # Adding to .env
    env_path = os.path.join(project_root, ".env")
    env_lines = []
    if os.path.exists(env_path):
        with open(env_path) as f:
            env_lines = f.readlines()
            
    updated = False
    for i, line in enumerate(env_lines):
        if line.startswith("RISK_ROUTER_ADDRESS="):
            env_lines[i] = f"RISK_ROUTER_ADDRESS={router_address}\n"
            updated = True
    if not updated:
        env_lines.append(f"RISK_ROUTER_ADDRESS={router_address}\n")
        
    with open(env_path, "w") as f:
        f.writelines(env_lines)

    print("Success. Run bot!")

if __name__ == "__main__":
    main()
