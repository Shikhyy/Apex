"""Startup health checks — verify all required services are available before trading."""

import asyncio
import logging
import os
import shutil
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class HealthCheckResult:
    """Result of a single health check."""
    
    def __init__(self, name: str, passed: bool, message: str = "", critical: bool = False):
        self.name = name
        self.passed = passed
        self.message = message
        self.critical = critical
    
    def __repr__(self):
        symbol = "✅" if self.passed else "❌"
        severity = "[CRITICAL]" if self.critical and not self.passed else ""
        return f"{symbol} {self.name} {severity} — {self.message}"


async def check_kraken_cli() -> HealthCheckResult:
    """Verify Kraken CLI is installed and executable."""
    try:
        kraken_bin = shutil.which("kraken")
        if kraken_bin:
            return HealthCheckResult(
                "Kraken CLI",
                True,
                f"Found at {kraken_bin}",
                critical=False
            )
        else:
            return HealthCheckResult(
                "Kraken CLI",
                False,
                "Not found in PATH. Install with: cargo install kraken-cli",
                critical=True
            )
    except Exception as e:
        return HealthCheckResult("Kraken CLI", False, str(e), critical=True)


async def check_surge_api() -> HealthCheckResult:
    """Verify Surge API credentials and connectivity."""
    try:
        api_key = os.environ.get("SURGE_API_KEY", "")
        vault = os.environ.get("SURGE_VAULT_ADDRESS", "")
        
        if not api_key or not vault:
            return HealthCheckResult(
                "Surge Credentials",
                False,
                "Missing SURGE_API_KEY or SURGE_VAULT_ADDRESS",
                critical=True
            )
        
        # Try a simple API call
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                response = await client.get(
                    "https://api.surge.trade/v1/health",
                    headers={"Authorization": f"Bearer {api_key}"}
                )
                if response.status_code == 200:
                    return HealthCheckResult(
                        "Surge API",
                        True,
                        "Connected and responding",
                        critical=False
                    )
            except Exception:
                pass
        
        return HealthCheckResult(
            "Surge API",
            False,
            "Cannot reach https://api.surge.trade",
            critical=True
        )
    except Exception as e:
        return HealthCheckResult("Surge API", False, str(e), critical=True)


async def check_base_rpc() -> HealthCheckResult:
    """Verify Base Sepolia RPC is reachable."""
    try:
        rpc_url = os.environ.get("BASE_SEPOLIA_RPC", "https://sepolia.base.org")
        
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "eth_chainId",
                "params": []
            }
            response = await client.post(rpc_url, json=payload)
            if response.status_code == 200:
                return HealthCheckResult(
                    "Base Sepolia RPC",
                    True,
                    f"Connected to {rpc_url}",
                    critical=False
                )
        
        return HealthCheckResult(
            "Base Sepolia RPC",
            False,
            f"No response from {rpc_url}",
            critical=True
        )
    except Exception as e:
        return HealthCheckResult("Base Sepolia RPC", False, str(e), critical=True)


async def check_erc8004_registry() -> HealthCheckResult:
    """Verify ERC-8004 Reputation Registry contract deployed."""
    try:
        registry_address = os.environ.get(
            "IDENTITY_REGISTRY_ADDRESS",
            "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
        )
        
        # Check if address is valid format
        if not registry_address.startswith("0x") or len(registry_address) != 42:
            return HealthCheckResult(
                "ERC-8004 Registry",
                False,
                f"Invalid registry address: {registry_address}",
                critical=False
            )
        
        return HealthCheckResult(
            "ERC-8004 Registry",
            True,
            f"Registry address configured: {registry_address}",
            critical=False
        )
    except Exception as e:
        return HealthCheckResult("ERC-8004 Registry", False, str(e), critical=False)


async def check_environment_variables() -> HealthCheckResult:
    """Verify all required environment variables are set."""
    required = [
        "GROQ_API_KEY",
        "BASE_SEPOLIA_RPC",
        "IDENTITY_REGISTRY_ADDRESS",
    ]
    
    optional = [
        "KRAKEN_API_KEY",
        "KRAKEN_API_SECRET",
        "SURGE_API_KEY",
        "SURGE_VAULT_ADDRESS",
        "APEX_PRIVATE_KEY",
    ]
    
    missing = [var for var in required if not os.environ.get(var)]
    
    if missing:
        return HealthCheckResult(
            "Environment Variables",
            False,
            f"Missing required: {', '.join(missing)}",
            critical=True
        )
    
    return HealthCheckResult(
        "Environment Variables",
        True,
        f"All {len(required)} required variables set",
        critical=False
    )


async def run_all_checks() -> tuple[list[HealthCheckResult], bool]:
    """Run all health checks and return results + overall status.
    
    Returns:
        (results, all_critical_passed) where all_critical_passed means no critical checks failed
    """
    checks = [
        check_environment_variables(),
        check_kraken_cli(),
        check_surge_api(),
        check_base_rpc(),
        check_erc8004_registry(),
    ]
    
    results = await asyncio.gather(*checks)
    all_critical_passed = all(r.passed for r in results if r.critical)
    
    return results, all_critical_passed


def log_health_summary(results: list[HealthCheckResult]) -> None:
    """Log a summary of health check results."""
    passed = sum(1 for r in results if r.passed)
    total = len(results)
    critical_failed = [r for r in results if r.critical and not r.passed]
    
    logger.info(f"\n{'='*60}")
    logger.info(f"APEX STARTUP HEALTH CHECK: {passed}/{total} checks passed")
    logger.info(f"{'='*60}")
    
    for result in results:
        logger.info(str(result))
    
    if critical_failed:
        logger.error(f"\n⚠️  {len(critical_failed)} CRITICAL ISSUES:")
        for result in critical_failed:
            logger.error(f"   - {result.name}: {result.message}")
        logger.error("\nSystem may not operate correctly until these issues are resolved.")
    else:
        logger.info("\n✅ All critical systems operational. Ready to trade.")
    
    logger.info(f"{'='*60}\n")
