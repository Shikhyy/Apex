"""One-time ERC-8004 agent registration script.

Run: python scripts/register_agents.py

This script:
1. Builds AgentCard JSON for each of the 4 agents
2. Uploads each AgentCard to IPFS via Pinata
3. Calls IdentityRegistry.register(agentURI) on Base Sepolia
4. Writes agentIds to agents.json
5. Prints env vars to copy to .env
"""

import argparse
import json
import os
import sys

import httpx
from dotenv import load_dotenv
from eth_account import Account
from web3 import Web3

load_dotenv()

BASE_SEPOLIA_RPC = os.environ.get("BASE_SEPOLIA_RPC", "https://sepolia.base.org")
PRIVATE_KEY = os.environ.get("APEX_PRIVATE_KEY", "")
PINATA_JWT = os.environ.get("PINATA_JWT", "")
IDENTITY_REGISTRY_ADDRESS = os.environ.get(
    "IDENTITY_REGISTRY_ADDRESS",
    "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
)

AGENTS = [
    {
        "name": "apex-scout",
        "role": "Market Intelligence Agent",
        "description": "Discovers yield opportunities across DeFi protocols in real time.",
        "services": [{"name": "MCP", "endpoint": "http://localhost:8000/mcp/scout"}],
        "x402Support": True,
    },
    {
        "name": "apex-strategist",
        "role": "Trade Intent Generator",
        "description": "Ranks opportunities and generates EIP-712 signed trade intents.",
        "services": [
            {"name": "MCP", "endpoint": "http://localhost:8000/mcp/strategist"}
        ],
        "x402Support": True,
    },
    {
        "name": "apex-guardian",
        "role": "Risk Management & Circuit Breaker",
        "description": "Evaluates every trade intent and vetoes dangerous trades. Earns reputation for correct vetoes.",
        "services": [{"name": "MCP", "endpoint": "http://localhost:8000/mcp/guardian"}],
        "x402Support": True,
    },
    {
        "name": "apex-executor",
        "role": "On-Chain & CEX Trade Executor",
        "description": "Executes approved trades via Surge Risk Router and Kraken CLI.",
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

    if (
        not IDENTITY_REGISTRY_ADDRESS.startswith("0x")
        or len(IDENTITY_REGISTRY_ADDRESS) != 42
    ):
        errors.append(
            f"IDENTITY_REGISTRY_ADDRESS has invalid format: {IDENTITY_REGISTRY_ADDRESS}"
        )

    return errors


def upload_to_ipfs(payload: dict) -> str:
    """Upload JSON payload to Pinata IPFS and return ipfs:// URI."""
    if not PINATA_JWT:
        print("  ⚠ PINATA_JWT not set — using mock data URI")
        import base64

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


def register_agent(w3: Web3, account: Account, agent_uri: str) -> int:
    """Register an agent on the ERC-8004 Identity Registry and return agentId."""
    abi = [
        {
            "inputs": [
                {"internalType": "string", "name": "agentURI", "type": "string"}
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
    ]

    contract = w3.eth.contract(
        address=Web3.to_checksum_address(IDENTITY_REGISTRY_ADDRESS), abi=abi
    )

    nonce = w3.eth.get_transaction_count(account.address)
    tx = contract.functions.register(agent_uri).build_transaction(
        {
            "from": account.address,
            "nonce": nonce,
            "gas": 500_000,
            "gasPrice": w3.eth.gas_price,
        }
    )

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

    if receipt.status != 1:
        raise Exception(f"Transaction reverted: {receipt}")

    # Extract agentId from Transfer event (tokenId = agentId)
    transfer_event = contract.events.Transfer().process_receipt(receipt)
    if transfer_event:
        return transfer_event[0]["args"]["tokenId"]

    # Fallback: read totalAgents
    total = contract.functions.totalAgents().call()
    return total - 1


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
        if args.dry_run:
            fatal = any("[warning]" not in e for e in errors)
            print(
                f"\nDry run complete — {'fix fatal errors' if fatal else 'warnings only, can proceed'} before running for real."
            )
            sys.exit(1 if fatal else 0)
        else:
            print("\nAborting. Fix errors or use --dry-run to validate config.")
            sys.exit(1)
    print("  ✓ Configuration valid\n")

    if args.dry_run:
        print("Dry run mode — no on-chain transactions will be sent.")
        w3 = Web3(Web3.HTTPProvider(BASE_SEPOLIA_RPC))
        if not w3.is_connected():
            print(f"  ✗ Cannot connect to Base Sepolia RPC at {BASE_SEPOLIA_RPC}")
            sys.exit(1)
        print(f"  ✓ Base Sepolia RPC connected")

        account = Account.from_key(PRIVATE_KEY)
        print(f"  ✓ Wallet: {account.address}")
        balance = w3.eth.get_balance(account.address)
        print(f"  ✓ Balance: {w3.from_wei(balance, 'ether')} ETH")

        print(f"\n  Would register {len(AGENTS)} agents:")
        for agent in AGENTS:
            print(f"    - {agent['name']} ({agent['role']})")
        print("\nDry run complete.")
        sys.exit(0)

    # Full registration
    w3 = Web3(Web3.HTTPProvider(BASE_SEPOLIA_RPC))
    if not w3.is_connected():
        print(f"ERROR: Cannot connect to Base Sepolia RPC at {BASE_SEPOLIA_RPC}")
        sys.exit(1)

    account = Account.from_key(PRIVATE_KEY)
    print(f"Using wallet: {account.address}")
    balance = w3.eth.get_balance(account.address)
    print(f"Balance: {w3.from_wei(balance, 'ether')} ETH")
    print()

    agent_ids = {}

    for agent in AGENTS:
        name = agent["name"]
        print(f"Registering {name}...")

        # Step 1: Upload AgentCard to IPFS
        print("  Uploading AgentCard to IPFS...")
        agent_uri = upload_to_ipfs(agent)
        print(f"  URI: {agent_uri[:60]}...")

        # Step 2: Register on-chain
        print("  Registering on Identity Registry...")
        try:
            agent_id = register_agent(w3, account, agent_uri)
            agent_ids[name.replace("apex-", "")] = agent_id
            print(f"  ✓ Registered with agentId={agent_id}")
        except Exception as e:
            print(f"  ✗ Registration failed: {e}")
            agent_ids[name.replace("apex-", "")] = None
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
