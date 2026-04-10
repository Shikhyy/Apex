<p align="center">
  <img src="frontend/public/favicon.svg" alt="APEX Logo" width="72" height="72" />
</p>

<h1 align="center">APEX</h1>
<p align="center"><strong>Autonomous Multi-Agent Yield Engine with On-Chain Reputation</strong></p>

<p align="center">
  <img src="https://img.shields.io/badge/status-active-success?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/python-3.12+-blue?style=for-the-badge&logo=python" alt="Python" />
  <img src="https://img.shields.io/badge/next.js-15-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/base-sepolia-verified?style=for-the-badge&logo=ethereum" alt="Base Sepolia" />
</p>

## What APEX Does
APEX runs an autonomous 4-agent pipeline for yield opportunities and risk gating:

1. Scout discovers opportunities and market context.
2. Strategist ranks intents and position sizes.
3. Guardian approves or vetoes based on strict thresholds.
4. Executor executes approved trades and records outcomes.

Every cycle is streamed live over SSE and persisted to logs for replay in the dashboard.

## Architecture

- Backend: FastAPI + LangGraph orchestration
- Frontend: Next.js App Router + TypeScript + wagmi/RainbowKit
- Contracts: Identity Registry, Reputation Registry, RiskRouter (Base Sepolia)
- Data: PRISM, Aerodrome/Aave/Curve/Compound adapters, Supabase log persistence

Core runtime path:

```text
scout -> strategist -> guardian -> (executor | veto) -> done
```

## Product Surfaces

- `/` marketing landing + live visual pipeline
- `/dashboard` cycle monitor, live stream, current decision, session metrics
- `/dashboard/agents` per-agent details and reputation views
- `/dashboard/portfolio` PnL and portfolio metrics
- `/dashboard/veto-log` filterable veto history
- `/dashboard/settings` runtime config + contract references
- `/docs` protocol and endpoint documentation

## Trading Modes (Important)
APEX can run in different execution modes depending on credentials and policy:

1. Full autonomous mode: backend auto-trader loop runs continuously.
2. Guarded mode: Guardian vetoes most risky cycles (expected behavior).
3. Simulated execution fallback: if execution credentials or routing config are missing, executor returns simulated fills/PnL.
4. Real execution path: requires complete on-chain/CEX configuration and passing Guardian approval.

In short: no real trades happen when cycles are vetoed or execution config is incomplete.

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- Optional: Supabase for persistent event log

### Install

```bash
git clone https://github.com/Shikhyy/Apex.git
cd Apex
pip install -r requirements.txt
cd frontend && npm install && cd ..
```

### Configure

```bash
cp .env.example .env
```

Minimum useful variables:

- `GROQ_API_KEY`
- `APEX_PRIVATE_KEY`
- `APEX_SCOUT_AGENT_ID`
- `APEX_STRATEGIST_AGENT_ID`
- `APEX_GUARDIAN_AGENT_ID`
- `APEX_EXECUTOR_AGENT_ID`

Execution-related variables:

- `RISK_ROUTER_ADDRESS`
- `BASE_SEPOLIA_RPC`
- `SURGE_API_KEY`
- `SURGE_VAULT_ADDRESS`
- `KRAKEN_API_KEY`
- `KRAKEN_API_SECRET`

Automation control:

- `APEX_AUTOTRADE_ENABLED` (default true)
- `APEX_AUTOTRADE_INTERVAL_SECONDS`

### Run

Backend:

```bash
uvicorn api:app --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm run dev
```

Open:

- Frontend: http://localhost:3000
- API health: http://127.0.0.1:8000/health
- SSE stream: http://127.0.0.1:8000/stream

## API Endpoints

- `GET /health` runtime and automation status
- `GET /stream` server-sent event stream
- `POST /cycle` trigger a cycle manually
- `GET /log` recent cycle events
- `GET /agents` registered agent metadata
- `GET /reputation/{agent_id}` reputation summary/signals
- `GET /market/prices` market prices
- `GET /market/signals` market signals
- `GET /market/aerodrome-pools` liquidity/yield snapshot

## Demonstrating Live Agents and PnL

1. Ensure backend is running and `/health` is OK.
2. Open dashboard at `/dashboard` to observe node progression.
3. Watch SSE directly from `/stream` to confirm live event emission.
4. Inspect `/log` for `guardian`, `executor`, and `done` nodes:
   - `guardian_decision = APPROVED` is required for executor.
   - `actual_pnl` appears on executor events.
   - `session_pnl`, `approval_count`, `veto_count` are finalized on `done`.

## Repo Layout

```text
api.py
agents/
mcp_tools/
contracts/
frontend/
scripts/
tests/
```

## Testing

Backend tests:

```bash
pytest -q
```

Frontend production check:

```bash
cd frontend
npm run build
```

## License
MIT
