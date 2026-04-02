<p align="center">
  <img src="https://img.shields.io/badge/status-active-success?style=for-the-badge" alt="Status">
  <img src="https://img.shields.io/badge/python-3.12+-blue?style=for-the-badge&logo=python" alt="Python">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License">
</p>

<h1 align="center">⚡ APEX</h1>
<p align="center"><strong>Self-Certifying Yield Optimizer</strong></p>
<p align="center">Multi-agent DeFi system that earns on-chain reputation by refusing bad trades</p>

---

## Overview

APEX is an autonomous multi-agent yield optimizer where every decision is a **verifiable on-chain artifact**. The system is designed so that the most trustworthy outcome is also the highest-reputation outcome: an agent that correctly refuses a dangerous trade gains more ERC-8004 reputation than one that blindly executes.

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   Scout ──→ Strategist ──→ Guardian ──→ Executor                   │
│   (Market    (Rank         (Risk         (On-Chain                  │
│    Intel)     Intents)      Breaker)      Execute)                   │
│                                  │                                  │
│                             ┌───┴────┐                              │
│                             │ VETO   │ ← Earns more reputation     │
│                             │ Logger │   than blind approval       │
│                             └────────┘                              │
│                                                                     │
│   Every decision → IPFS evidence → ERC-8004 Reputation Registry     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Features

- **Multi-Agent Pipeline** — Scout, Strategist, Guardian, and Executor agents orchestrated by LangGraph
- **ERC-8004 Reputation** — On-chain agent identity and reputation signals on Base Sepolia
- **Risk-First Design** — Guardian veto earns more reputation than approval; safety is incentivized
- **Real-Time SSE Streaming** — Watch agent decisions unfold live in the dashboard
- **Multi-Source Market Data** — PRISM AI signals, Aerodrome pools, Aave, Curve, Compound yields
- **EIP-712 Signed Intents** — Cryptographically verifiable trade intents before execution
- **Dual Execution Paths** — Surge Risk Router (on-chain) + Kraken CLI (CEX) with mock fallbacks
- **Persistent History** — Supabase-backed cycle log and reputation tracking

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  FRONTEND LAYER                                                     │
│  Next.js 15 · React 19 · TypeScript · Recharts · Viem              │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │ Agent    │ │ PnL      │ │ Opps &   │ │ Market   │              │
│  │ Cards    │ │ Chart    │ │ Intents  │ │ Signals  │              │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘              │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ SSE / REST
┌─────────────────────────────▼───────────────────────────────────────┐
│  BACKEND LAYER                                                      │
│  FastAPI · LangGraph · Groq LPU (Llama 3.3 70B) · Python           │
│                                                                     │
│  GET  /health          — System status                              │
│  GET  /stream          — SSE event stream                           │
│  POST /cycle           — Trigger agent pipeline                     │
│  GET  /log             — Cycle history                              │
│  GET  /agents          — Registered agent metadata                  │
│  GET  /reputation/{id} — On-chain reputation signals                │
│  GET  /market/prices   — Real-time prices (PRISM)                   │
│  GET  /market/signals  — AI trading signals (PRISM)                 │
│  GET  /market/aerodrome-pools — Base liquidity pools                │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ MCP Tool Calls
┌─────────────────────────────▼───────────────────────────────────────┐
│  SKILLS LAYER (FastMCP Server)                                      │
│                                                                     │
│  fetch_aave_yields          fetch_curve_pools                       │
│  fetch_compound_rates       fetch_volatility_index                  │
│  fetch_sentiment            calculate_projected_drawdown            │
│  fetch_agent_reputation     check_protocol_audit_status             │
│  estimate_gas_cost          generate_eip712_intent                  │
│  calculate_position_size    execute_surge_intent                    │
│  execute_kraken_order       calculate_realized_pnl                  │
│  post_reputation_signal     get_agent_card                          │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ On-Chain / External APIs
┌─────────────────────────────▼───────────────────────────────────────┐
│  EXTERNAL LAYER                                                     │
│                                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │
│  │ Base Sepolia │ │ PRISM API    │ │ Aerodrome    │                │
│  │ ERC-8004     │ │ Prices/      │ │ Subgraph     │                │
│  │ Registries   │ │ Signals/Risk │ │ (Goldsky)    │                │
│  └──────────────┘ └──────────────┘ └──────────────┘                │
│                                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │
│  │ Surge Risk   │ │ Kraken CLI   │ │ Pinata IPFS  │                │
│  │ Router       │ │ (CEX Exec)   │ │ (Evidence)   │                │
│  └──────────────┘ └──────────────┘ └──────────────┘                │
│                                                                     │
│  ┌──────────────┐ ┌──────────────┐                                  │
│  │ Supabase     │ │ Groq LPU     │                                  │
│  │ (Persistence)│ │ (LLM)        │                                  │
│  └──────────────┘ └──────────────┘                                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Agent Pipeline

Each cycle flows through four specialized agents:

| Agent | Role | LLM Model | Key Responsibilities |
|-------|------|-----------|---------------------|
| **Scout** | Market Intelligence | Llama 3.3 70B | Fetches yields from Aave/Curve/Compound/Aerodrome, PRISM signals, volatility & sentiment |
| **Strategist** | Trade Intent Generator | Llama 3.3 70B | Ranks opportunities, calculates position sizes, generates EIP-712 signed intents |
| **Guardian** | Risk Manager & Circuit Breaker | Llama 3.3 70B | 7 veto conditions (volatility, drawdown, APY, liquidity, sentiment, reputation, uncertainty) |
| **Executor** | On-Chain & CEX Trade Executor | — | Executes via Surge Risk Router or Kraken CLI, posts reputation signals |

### Guardian Veto Conditions

The Guardian **immediately vetoes** if any single condition is met:

```
1. Volatility index    > 65.0
2. Projected drawdown  > 5.0%
3. Scout reputation    < 0.60
4. APY                 > 50%  (exploit/rug risk)
5. Pool liquidity      < $500K
6. Sentiment score     < -0.5
7. LLM uncertainty     → when in doubt, VETO
```

## Project Structure

```
apex/
├── api.py                      # FastAPI server (SSE, REST, cycle orchestration)
├── agents/
│   ├── graph.py                # LangGraph StateGraph definition
│   ├── scout.py                # Market intelligence agent
│   ├── strategist.py           # Trade intent generation agent
│   ├── guardian.py             # Risk management & circuit breaker agent
│   └── executor.py             # Trade execution agent
├── mcp_tools/
│   ├── server.py               # FastMCP skill server
│   ├── market_data.py          # Aave, Curve, Compound yield fetchers
│   ├── prism_api.py            # PRISM API client (prices, signals, risk)
│   ├── aerodrome_pools.py      # Aerodrome subgraph query + mock fallback
│   ├── execution.py            # Surge Risk Router + Kraken CLI execution
│   ├── signing.py              # EIP-712 intent signing
│   ├── risk_analysis.py        # Drawdown, gas estimation, audit checks
│   └── erc8004_skills.py       # ERC-8004 reputation signals & agent cards
├── frontend/
│   ├── app/page.tsx            # Main dashboard (agent cards, PnL chart, veto log)
│   ├── components/dashboard/   # Recharts PnL chart, opportunities table, market signals
│   └── lib/                    # API client, TypeScript types
├── scripts/
│   ├── register_agents.py      # On-chain agent registration
│   └── deploy_contracts.py     # Contract deployment helper
├── tests/                      # 13 test modules covering all agents & tools
├── Dockerfile                  # Backend container
├── docker-compose.yml          # Full stack (backend + frontend)
├── requirements.txt            # Python dependencies
└── agents.json                 # Agent ID registry
```

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- [Supabase](https://supabase.com) project (for persistent history)

### 1. Clone & Install

```bash
git clone https://github.com/Shikhyy/Apex.git
cd Apex

# Python dependencies
pip install -r requirements.txt

# Frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Fill in the required variables:

| Variable | Purpose | Required |
|----------|---------|----------|
| `GROQ_API_KEY` | LLM inference (Llama 3.3 70B) | Yes |
| `APEX_PRIVATE_KEY` | On-chain transaction signing | Yes |
| `APEX_SCOUT_AGENT_ID` | Scout's ERC-8004 agent ID | After registration |
| `APEX_STRATEGIST_AGENT_ID` | Strategist's ERC-8004 agent ID | After registration |
| `APEX_GUARDIAN_AGENT_ID` | Guardian's ERC-8004 agent ID | After registration |
| `APEX_EXECUTOR_AGENT_ID` | Executor's ERC-8004 agent ID | After registration |
| `PINATA_JWT` | IPFS evidence storage | Yes |
| `SURGE_API_KEY` | On-chain trade execution | Optional |
| `KRAKEN_API_KEY` | CEX trade execution | Optional |
| `LANGSMITH_API_KEY` | Agent observability | Optional |

### 3. Register Agents On-Chain

```bash
python scripts/register_agents.py
```

This mints ERC-8004 agent NFTs and writes IDs to `agents.json`.

### 4. Start Services

```bash
# Backend
uvicorn api:app --reload --port 8000

# Frontend (in another terminal)
cd frontend && npm run dev
```

Or use Docker:

```bash
docker compose up --build
```

### 5. Open Dashboard

Navigate to `http://localhost:3000` and click **▶ RUN CYCLE** to watch the agent pipeline in action.

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | System health check (keys, agent IDs, RPC) |
| `/stream` | GET | SSE stream of live agent decisions |
| `/cycle` | POST | Trigger a new agent pipeline cycle |
| `/log` | GET | Retrieve in-memory cycle history |
| `/agents` | GET | List registered agents with metadata |
| `/reputation/{agent_id}` | GET | Fetch on-chain reputation signals |
| `/market/prices` | GET | Real-time prices from PRISM API |
| `/market/signals` | GET | AI trading signals from PRISM API |
| `/market/aerodrome-pools` | GET | Top Aerodrome liquidity pools on Base |

## Contract Addresses

| Contract | Network | Address |
|----------|---------|---------|
| Identity Registry | Base Sepolia | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Reputation Registry | Base Sepolia | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

## Integrations

| Service | Purpose | Status |
|---------|---------|--------|
| **PRISM API** | Multi-asset prices, AI signals, risk metrics | Integrated |
| **Aerodrome Finance** | Base liquidity pool data via subgraph | Integrated |
| **Kraken CLI** | Paper + live CEX trade execution | Integrated |
| **ERC-8004** | On-chain agent identity + reputation | Integrated |
| **Surge API** | On-chain trade execution via Risk Router | Stubbed |
| **Supabase** | Persistent cycle history | Integrated |
| **LangSmith** | Agent observability & tracing | Optional |
| **Pinata IPFS** | Evidence storage for reputation signals | Integrated |

## Testing

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test module
pytest tests/test_guardian.py -v
```

Test coverage spans all four agents, MCP tools, market data fetchers, signing utilities, and API endpoints.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, React 19, TypeScript, Recharts, Viem |
| **Backend** | FastAPI, LangGraph, langchain-groq, Pydantic |
| **LLM** | Groq LPU — Llama 3.3 70B Versatile |
| **Blockchain** | ERC-8004, Base Sepolia, web3.py, eth-account |
| **Data** | PRISM API, Aerodrome Subgraph (Goldsky) |
| **Storage** | Supabase (cycles), Pinata IPFS (evidence) |
| **Execution** | Surge Risk Router, Kraken CLI |
| **Container** | Docker, docker-compose |

## License

MIT
