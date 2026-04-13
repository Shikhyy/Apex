"""One-time ERC-8004 agent registration script.

Run: python scripts/register_agents.py

This script:
1. Builds AgentCard JSON for each of the 4 agents
2. Uploads each AgentCard to IPFS via Pinata
3. Registers each agent on the shared Sepolia AgentRegistry
4. Claims the shared HackathonVault allocation for each agentId
5. Writes agentIds to agents.json
6. Prints env vars to copy to .env
"""

import argparse
import json
import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv
from eth_account import Account
from web3 import Web3

load_dotenv()

BASE_SEPOLIA_RPC = os.environ.get(
    "SEPOLIA_RPC_URL",
    os.environ.get("BASE_SEPOLIA_RPC", "https://ethereum-sepolia-rpc.publicnode.com"),
)
PRIVATE_KEY = os.environ.get("APEX_PRIVATE_KEY", "")
PINATA_JWT = os.environ.get("PINATA_JWT", "")
AGENT_REGISTRY_ADDRESS = os.environ.get(
    "AGENT_REGISTRY_ADDRESS",
    os.environ.get(
        "IDENTITY_REGISTRY_ADDRESS",
        "0x97b07dDc405B0c28B17559aFFE63BdB3632d0ca3",
    ),
)
HACKATHON_VAULT_ADDRESS = os.environ.get(
    "HACKATHON_VAULT_ADDRESS",
    "0x0E7CD8ef9743FEcf94f9103033a044caBD45fC90",
)
RISK_ROUTER_ADDRESS = os.environ.get(
    "RISK_ROUTER_ADDRESS",
    "0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC",
)

AGENTS = [
    {
        "name": "apex-scout",
        "role": "Market Intelligence Agent",
        "description": "Discovers yield opportunities across DeFi protocols in real time.",
        "wallet_seed": "apex-scout-agent-wallet-v1",
        "services": [{"name": "MCP", "endpoint": "http://localhost:8000/mcp/scout"}],
        "x402Support": True,
    },
    {
        "name": "apex-strategist",
        "role": "Trade Intent Generator",
        "description": "Ranks opportunities and generates EIP-712 signed trade intents.",
        "wallet_seed": "apex-strategist-agent-wallet-v1",
        "services": [
            {"name": "MCP", "endpoint": "http://localhost:8000/mcp/strategist"}
        ],
        "x402Support": True,
    },
    {
        "name": "apex-guardian",
        "role": "Risk Management & Circuit Breaker",
        "description": "Evaluates every trade intent and vetoes dangerous trades. Earns reputation for correct vetoes.",
        "wallet_seed": "apex-guardian-agent-wallet-v1",
        "services": [{"name": "MCP", "endpoint": "http://localhost:8000/mcp/guardian"}],
        "x402Support": True,
    },
    {
        "name": "apex-executor",
        "role": "On-Chain & CEX Trade Executor",
        "description": "Executes approved trades via Surge Risk Router and Kraken CLI.",
        "wallet_seed": "apex-executor-agent-wallet-v1",
        "services": [{"name": "MCP", "endpoint": "http://localhost:8000/mcp/executor"}],
        "x402Support": True,
    },
]


def validate_config() -> list[str]:
    """Validate configuration and return list of errors."""
    errors = []
    if not PRIVATE_KEY:
        errors.append("APEX_PRIVATE_KEY is not set")
    else:
        key = PRIVATE_KEY if PRIVATE_KEY.startswith("0x") else f"0x{PRIVATE_KEY}"
        if len(key) != 66:
            errors.append(
                f"APEX_PRIVATE_KEY has invalid format (expected 0x + 64 hex chars, got {len(key)} chars)"
            )
        else:
            try:
                Account.from_key(key)
            except Exception:
                errors.append("APEX_PRIVATE_KEY is not a valid private key")

    if not PINATA_JWT:
        errors.append("PINATA_JWT is not set (will use data URI fallback) [warning]")

    for name, address in (
        ("AGENT_REGISTRY_ADDRESS", AGENT_REGISTRY_ADDRESS),
        ("HACKATHON_VAULT_ADDRESS", HACKATHON_VAULT_ADDRESS),
        ("RISK_ROUTER_ADDRESS", RISK_ROUTER_ADDRESS),
    ):
        if not address.startswith("0x") or len(address) != 42:
            errors.append(f"{name} has invalid format: {address}")

    return errors


def upload_to_ipfs(payload: dict) -> str:
    """Upload JSON payload to Pinata IPFS and return ipfs:// URI."""
    def fallback_data_uri() -> str:
        # Keep fallback metadata compact to avoid high gas costs when storing tokenURI on-chain.
        minimal = {
            "name": payload.get("name", "apex-agent"),
            "role": payload.get("role", "agent"),
            "version": "1.0.0",
        }
        return f"data:application/json,{json.dumps(minimal, separators=(',', ':'))}"

    if not PINATA_JWT:
        print("  ⚠ PINATA_JWT not set — using mock data URI")
        return fallback_data_uri()

    url = "https://api.pinata.cloud/pinning/pinJSONToIPFS"
    headers = {
        "Authorization": f"Bearer {PINATA_JWT}",
        "Content-Type": "application/json",
    }
    try:
        resp = httpx.post(url, json=payload, headers=headers, timeout=30)
        resp.raise_for_status()
        ipfs_hash = resp.json()["IpfsHash"]
        return f"ipfs://{ipfs_hash}"
    except Exception as e:
        print(f"  ⚠ Pinata upload failed ({e}) — falling back to data URI")
        return fallback_data_uri()


def derive_agent_wallet(seed: str) -> Account:
    """Derive a deterministic agent wallet from a fixed seed string."""
    return Account.from_key(Web3.keccak(text=seed))


def register_agent(
    w3: Web3,
    account: Account,
    agent_wallet: Account,
    agent: dict,
    agent_uri: str,
) -> int:
    """Register an agent on the shared ERC-8004 AgentRegistry and return agentId."""
    abi = [
        {
            "inputs": [
                {"internalType": "address", "name": "agentWallet", "type": "address"},
                {"internalType": "string", "name": "name", "type": "string"},
                {"internalType": "string", "name": "description", "type": "string"},
                {"internalType": "string[]", "name": "capabilities", "type": "string[]"},
                {"internalType": "string", "name": "agentURI", "type": "string"},
            ],
            "name": "register",
            "outputs": [
                {"internalType": "uint256", "name": "agentId", "type": "uint256"}
            ],
            "stateMutability": "nonpayable",
            "type": "function",
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
            "anonymous": False,
            "inputs": [
                {"indexed": True, "internalType": "uint256", "name": "agentId", "type": "uint256"},
                {"indexed": True, "internalType": "address", "name": "operatorWallet", "type": "address"},
                {"indexed": True, "internalType": "address", "name": "agentWallet", "type": "address"},
                {"indexed": False, "internalType": "string", "name": "name", "type": "string"},
            ],
            "name": "AgentRegistered",
            "type": "event",
        },
    ]

    contract = w3.eth.contract(
        address=Web3.to_checksum_address(AGENT_REGISTRY_ADDRESS), abi=abi
    )

    nonce = w3.eth.get_transaction_count(account.address, "pending")
    register_fn = contract.functions.register(
        agent_wallet.address,
        agent["name"],
        agent["description"],
        ["trading", "analysis", "eip712-signing"],
        agent_uri,
    )

    estimated_gas = register_fn.estimate_gas({"from": account.address})
    gas_limit = max(int(estimated_gas * 2.0) + 200_000, 1_200_000)

    tx = register_fn.build_transaction(
        {
            "from": account.address,
            "nonce": nonce,
            "gas": gas_limit,
            "gasPrice": w3.eth.gas_price,
        }
    )

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=240)

    if receipt.status != 1:
        raise Exception(f"Transaction reverted: {receipt}")

    registered_event = contract.events.AgentRegistered().process_receipt(receipt)
    if registered_event:
        return registered_event[0]["args"]["agentId"]

    transfer_event = contract.events.Transfer().process_receipt(receipt)
    if transfer_event:
        return transfer_event[0]["args"]["tokenId"]

    raise RuntimeError("AgentRegistered/Transfer event not found in receipt")


def claim_vault_allocation(w3: Web3, account: Account, agent_id: int) -> None:
    """Claim the shared vault allocation for a registered agent."""
    abi = [
        {"inputs": [{"internalType": "uint256", "name": "agentId", "type": "uint256"}], "name": "claimAllocation", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
        {"inputs": [{"internalType": "uint256", "name": "agentId", "type": "uint256"}], "name": "hasClaimed", "outputs": [{"internalType": "bool", "name": "", "type": "bool"}], "stateMutability": "view", "type": "function"},
        {"inputs": [{"internalType": "uint256", "name": "agentId", "type": "uint256"}], "name": "getBalance", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
        {"inputs": [], "name": "allocationPerTeam", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    ]

    contract = w3.eth.contract(
        address=Web3.to_checksum_address(HACKATHON_VAULT_ADDRESS), abi=abi
    )
    if contract.functions.hasClaimed(agent_id).call():
        return

    nonce = w3.eth.get_transaction_count(account.address, "pending")
    claim_fn = contract.functions.claimAllocation(agent_id)
    estimated_gas = claim_fn.estimate_gas({"from": account.address})
    gas_limit = max(int(estimated_gas * 1.8) + 80_000, 250_000)

    tx = claim_fn.build_transaction(
        {
            "from": account.address,
            "nonce": nonce,
            "gas": gas_limit,
            "gasPrice": w3.eth.gas_price,
        }
    )
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=240)
    if receipt.status != 1:
        raise Exception(f"Vault claim reverted: {receipt}")

    allocation = contract.functions.allocationPerTeam().call()
    balance = contract.functions.getBalance(agent_id).call()
    if balance != allocation:
        raise RuntimeError(
            f"Vault claim verification failed for agentId={agent_id}: expected {allocation}, got {balance}"
        )


def main():
    parser = argparse.ArgumentParser(
        description="Register APEX agents on ERC-8004 Identity Registry"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate config without writing on-chain",
    )
    args = parser.parse_args()

    # Pre-flight validation
    print("Running pre-flight validation...")
    errors = validate_config()
    if errors:
        print("\nConfiguration issues:")
        for err in errors:
            prefix = "✗" if "not set" in err or "invalid" in err else "⚠"
            print(f"  {prefix} {err}")
        fatal = any("[warning]" not in e for e in errors)
        if args.dry_run:
            print(
                f"\nDry run complete — {'fix fatal errors' if fatal else 'warnings only, can proceed'} before running for real."
            )
            sys.exit(1 if fatal else 0)
        if fatal:
            print("\nAborting. Fix errors or use --dry-run to validate config.")
            sys.exit(1)
        print("  ✓ Warnings only — continuing with fallback behavior\n")
    print("  ✓ Configuration valid\n")

    if args.dry_run:
        print("Dry run mode — no on-chain transactions will be sent.")
        w3 = Web3(Web3.HTTPProvider(BASE_SEPOLIA_RPC))
        if not w3.is_connected():
            print(f"  ✗ Cannot connect to Sepolia RPC at {BASE_SEPOLIA_RPC}")
            sys.exit(1)
        print(f"  ✓ Sepolia RPC connected")

        account = Account.from_key(PRIVATE_KEY)
        print(f"  ✓ Wallet: {account.address}")
        balance = w3.eth.get_balance(account.address)
        print(f"  ✓ Balance: {w3.from_wei(balance, 'ether')} ETH")

        print(f"\n  Would register {len(AGENTS)} agents and claim vault funds:")
        for agent in AGENTS:
            print(f"    - {agent['name']} ({agent['role']})")
        print("\nDry run complete.")
        sys.exit(0)

    # Full registration
    w3 = Web3(Web3.HTTPProvider(BASE_SEPOLIA_RPC))
    if not w3.is_connected():
        print(f"ERROR: Cannot connect to Sepolia RPC at {BASE_SEPOLIA_RPC}")
        sys.exit(1)

    account = Account.from_key(PRIVATE_KEY)
    print(f"Using wallet: {account.address}")
    balance = w3.eth.get_balance(account.address)
    print(f"Balance: {w3.from_wei(balance, 'ether')} ETH")
    print()

    min_required = w3.to_wei(0.01, "ether")
    if balance < min_required:
        print(
            "ERROR: insufficient Sepolia ETH for registration and vault claiming. "
            "Fund the operator wallet and rerun this script."
        )
        sys.exit(1)

    agent_ids = {}
    existing_path = Path(os.path.dirname(os.path.dirname(__file__))) / "agents.json"
    existing_ids = {"scout": 0, "strategist": 0, "guardian": 0, "executor": 0}
    if existing_path.exists():
        try:
            existing_ids.update(json.loads(existing_path.read_text()))
        except Exception:
            pass

    for agent in AGENTS:
        name = agent["name"]
        print(f"Registering {name}...")

        agent_wallet = derive_agent_wallet(agent["wallet_seed"])
        print(f"  Agent wallet: {agent_wallet.address}")

        # Step 1: Upload AgentCard to IPFS
        print("  Uploading AgentCard to IPFS...")
        agent_uri = upload_to_ipfs(agent)
        print(f"  URI: {agent_uri[:60]}...")

        # Step 2: Register on-chain
        print("  Registering on shared AgentRegistry...")
        try:
            agent_id = register_agent(w3, account, agent_wallet, agent, agent_uri)
            agent_ids[name.replace("apex-", "")] = agent_id
            print(f"  ✓ Registered with agentId={agent_id}")

            print("  Claiming shared vault allocation...")
            claim_vault_allocation(w3, account, agent_id)
            print("  ✓ Vault allocation claimed")

            if RISK_ROUTER_ADDRESS and RISK_ROUTER_ADDRESS.startswith("0x"):
                try:
                    router_abi = [
                        {
                            "inputs": [
                                {"internalType": "uint256", "name": "agentId", "type": "uint256"},
                                {"internalType": "uint256", "name": "maxPositionUsdScaled", "type": "uint256"},
                                {"internalType": "uint256", "name": "maxDrawdownBps", "type": "uint256"},
                                {"internalType": "uint256", "name": "maxTradesPerHour", "type": "uint256"},
                            ],
                            "name": "setRiskParams",
                            "outputs": [],
                            "stateMutability": "nonpayable",
                            "type": "function",
                        }
                    ]
                    router = w3.eth.contract(
                        address=Web3.to_checksum_address(RISK_ROUTER_ADDRESS), abi=router_abi
                    )
                    tx = router.functions.setRiskParams(
                        agent_id,
                        50_000,
                        500,
                        10,
                    ).build_transaction(
                        {
                            "from": account.address,
                            "nonce": w3.eth.get_transaction_count(account.address, "pending"),
                            "gas": 200_000,
                            "gasPrice": w3.eth.gas_price,
                        }
                    )
                    signed = account.sign_transaction(tx)
                    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
                    w3.eth.wait_for_transaction_receipt(tx_hash, timeout=240)
                    print("  ✓ Risk params set")
                except Exception as e:
                    print(f"  ⚠ Risk params skipped: {e}")
        except Exception as e:
            print(f"  ✗ Registration failed: {e}")
            key = name.replace("apex-", "")
            agent_ids[key] = existing_ids.get(key)
            # Write partial results so progress isn't lost
            output_path = os.path.join(
                os.path.dirname(os.path.dirname(__file__)), "agents.json"
            )
            with open(output_path, "w") as f:
                json.dump(agent_ids, f, indent=2)
            print(f"  Written partial results to {output_path}")

        print()

    # Step 3: Write agents.json
    output_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "agents.json"
    )
    with open(output_path, "w") as f:
        json.dump(agent_ids, f, indent=2)
    print(f"Written agent IDs to {output_path}")

    # Step 4: Print env vars
    print("\nAdd these to your .env file:")
    for key, value in agent_ids.items():
        print(f"  APEX_{key.upper()}_AGENT_ID={value}")


if __name__ == "__main__":
    main()
