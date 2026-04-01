"""FastMCP server for APEX skills."""

from fastmcp import FastMCP

from mcp_tools.market_data import (
    fetch_aave_yields,
    fetch_curve_pools,
    fetch_compound_rates,
    fetch_volatility_index,
    fetch_sentiment,
)
from mcp_tools.risk_analysis import (
    calculate_projected_drawdown,
    fetch_agent_reputation,
    check_protocol_audit_status,
    estimate_gas_cost,
)
from mcp_tools.signing import generate_eip712_intent, calculate_position_size
from mcp_tools.execution import (
    execute_surge_intent,
    execute_kraken_order,
    calculate_realized_pnl,
)
from mcp_tools.erc8004_skills import post_reputation_signal, get_agent_card

mcp = FastMCP("APEX Skills Server")

for skill in [
    fetch_aave_yields,
    fetch_curve_pools,
    fetch_compound_rates,
    fetch_volatility_index,
    fetch_sentiment,
    calculate_projected_drawdown,
    fetch_agent_reputation,
    check_protocol_audit_status,
    estimate_gas_cost,
    generate_eip712_intent,
    calculate_position_size,
    execute_surge_intent,
    execute_kraken_order,
    calculate_realized_pnl,
    post_reputation_signal,
    get_agent_card,
]:
    mcp.tool()(skill)

if __name__ == "__main__":
    mcp.run(transport="streamable-http", port=3001)
