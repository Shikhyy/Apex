#!/usr/bin/env python3
"""Diagnostic tool to identify blockers preventing trade execution."""

import os
import sys
from dotenv import load_dotenv
from web3 import Web3

load_dotenv()

print("=" * 70)
print("APEX EXECUTION DIAGNOSTIC")
print("=" * 70)

# 1. Environment check
print("\n[1] ENVIRONMENT CONFIGURATION")
print("-" * 70)

REQUIRED_VARS = [
    ("APEX_PRIVATE_KEY", "Private key for signer wallet"),
    ("RISK_ROUTER_ADDRESS", "RiskRouter contract address"),
    ("BASE_SEPOLIA_RPC", "Base Sepolia RPC endpoint"),
    ("REPUTATION_REGISTRY_ADDRESS", "Reputation registry contract"),
    ("APEX_EXECUTOR_AGENT_ID", "Executor agent ID for registration"),
]

env_ok = True
for var_name, desc in REQUIRED_VARS:
    val = os.environ.get(var_name, "").strip()
    if val:
        # Mask sensitive values
        if var_name == "APEX_PRIVATE_KEY":
            display = val[:6] + "..." + val[-4:] if len(val) > 10 else "***"
        else:
            display = val[:50] + "..." if len(val) > 50 else val
        print(f"✓ {var_name:30} = {display}")
    else:
        print(f"✗ {var_name:30} = MISSING!")
        env_ok = False

if not env_ok:
    print("\n⚠️  Missing required environment variables. Execution will fail.")
    sys.exit(1)

# 2. Wallet check
print("\n[2] WALLET CONFIGURATION")
print("-" * 70)

try:
    from eth_account import Account
    private_key = os.environ.get("APEX_PRIVATE_KEY")
    account = Account.from_key(private_key)
    print(f"✓ Signer wallet address: {account.address}")
except Exception as e:
    print(f"✗ Failed to load wallet: {e}")
    sys.exit(1)

# 3. RPC connectivity
print("\n[3] BASE SEPOLIA RPC CONNECTIVITY")
print("-" * 70)

rpc_url = os.environ.get("BASE_SEPOLIA_RPC", "https://sepolia.base.org")
try:
    w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 10}))
    if w3.is_connected():
        print(f"✓ RPC connected: {rpc_url}")
        latest_block = w3.eth.block_number
        print(f"✓ Latest block: {latest_block}")
    else:
        print(f"✗ RPC not responding: {rpc_url}")
        sys.exit(1)
except Exception as e:
    print(f"✗ RPC connection error: {e}")
    sys.exit(1)

# 4. Wallet balance check
print("\n[4] WALLET BALANCE & GAS ESTIMATION")
print("-" * 70)

try:
    balance_wei = w3.eth.get_balance(account.address)
    balance_eth = balance_wei / 1e18
    print(f"✓ Wallet balance: {balance_eth:.6f} ETH ({balance_wei} wei)")

    gas_price = w3.eth.gas_price
    estimated_gas_budget = 450_000  # submit + recorded bookkeeping
    min_required_wei = gas_price * estimated_gas_budget
    min_required_eth = min_required_wei / 1e18

    print(f"✓ Current gas price: {gas_price} wei")
    print(f"✓ Estimated gas budget: {estimated_gas_budget} gas")
    print(f"✓ Minimum required: {min_required_eth:.6f} ETH ({min_required_wei} wei)")

    if balance_wei >= min_required_wei:
        print("✓ Sufficient balance for execution")
    else:
        shortfall = min_required_wei - balance_wei
        shortfall_eth = shortfall / 1e18
        print(f"✗ INSUFFICIENT BALANCE! Need {shortfall_eth:.6f} ETH more")
except Exception as e:
    print(f"✗ Gas estimation error: {e}")

# 5. Contract address validation
print("\n[5] SMART CONTRACT ADDRESSES")
print("-" * 70)

router_address = os.environ.get("RISK_ROUTER_ADDRESS", "").strip()
rep_registry = os.environ.get("REPUTATION_REGISTRY_ADDRESS", "").strip()

try:
    router_checksum = Web3.to_checksum_address(router_address)
    print(f"✓ RiskRouter (checksum): {router_checksum}")
    
    rep_checksum = Web3.to_checksum_address(rep_registry)
    print(f"✓ Reputation Registry (checksum): {rep_checksum}")
except Exception as e:
    print(f"✗ Invalid contract address: {e}")

# 6. RiskRouter ABI
print("\n[6] RISKMROUTER ABI AVAILABILITY")
print("-" * 70)

project_root = os.path.dirname(os.path.abspath(__file__))
abi_path = os.path.join(project_root, "contracts", "out", "RiskRouter.sol", "RiskRouter.json")
if os.path.exists(abi_path):
    print(f"✓ RiskRouter.json found at: {abi_path}")
    try:
        import json
        with open(abi_path) as f:
            artifact = json.load(f)
            abi = artifact.get("abi", [])
            print(f"✓ ABI loaded with {len(abi)} functions/events")
    except Exception as e:
        print(f"✗ Failed to parse ABI: {e}")
else:
    print(f"✗ RiskRouter.json NOT FOUND at: {abi_path}")

# 7. Reputation fetch test
print("\n[7] REPUTATION FETCH TEST (Scout Agent)")
print("-" * 70)

try:
    from mcp_tools.risk_analysis import fetch_agent_reputation
    scout_id = int(os.environ.get("APEX_SCOUT_AGENT_ID", 2))
    rep = fetch_agent_reputation(scout_id)
    
    if rep.get("normalized") is None:
        print(f"⚠️  Scout reputation unavailable (bootstrap mode)")
        print(f"   Error: {rep.get('error', 'unknown')}")
        print(f"   Count: {rep.get('count', 0)} events")
    else:
        print(f"✓ Scout reputation: {rep['normalized']:.2f} (avg_score: {rep['avg_score']}, events: {rep['count']})")
except Exception as e:
    print(f"✗ Reputation fetch failed: {e}")

print("\n" + "=" * 70)
print("SUMMARY")
print("=" * 70)
print("""
If all checks passed:
  1. Your wallet has enough Base Sepolia ETH for gas
  2. RPC is reachable
  3. Contracts are deployed
  4. System is ready to execute trades

If reputation shows as 'unavailable':
  This is normal on first run. The system is now in bootstrap mode
  and will execute trades to build reputation history on-chain.

Next steps:
  1. Run the backend and let it execute trades
  2. Check /health endpoint: should show autotrader_running=true
  3. Check /log endpoint for executed cycles
  4. Reputation will improve after the first successful trade feedback is submitted
""")
