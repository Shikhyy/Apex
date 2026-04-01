# APEX

> **Self-certifying yield optimizer** — earns ERC-8004 reputation by refusing bad trades.

APEX is a multi-agent yield optimizer where every decision is a verifiable on-chain artifact. The system is designed so that the most trustworthy outcome is also the highest-reputation outcome: an agent that correctly refuses a dangerous trade gains more reputation than one that blindly executes.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   FRONTEND LAYER                        │
│  Next.js 15  ·  React 19  ·  TypeScript  ·  Viem       │
└────────────────────────┬────────────────────────────────┘
                         │ SSE / REST
┌────────────────────────▼─────────────────────────────────┐
│                   BACKEND LAYER                          │
│  FastAPI  ·  LangGraph  ·  langchain-groq  ·  Python     │
└────────────────────────┬─────────────────────────────────┘
                         │ Tool calls
┌────────────────────────▼─────────────────────────────────┐
│                   SKILLS LAYER                           │
│  FastMCP  ·  MCP Tools  ·  httpx  ·  web3.py             │
└────────────────────────┬─────────────────────────────────┘
                         │ On-chain / CEX
┌────────────────────────▼─────────────────────────────────┐
│                   BLOCKCHAIN LAYER                       │
│  ERC-8004  ·  Base Sepolia  ·  Viem  ·  Kraken CLI       │
└──────────────────────────────────────────────────────────┘
```

## Agent Pipeline

```
[Scout] → [Strategist] → [Guardian] → [Executor]
                                ↓ (veto)
                           [Veto Logger]
```

## Setup

```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Set up environment
cp .env.example .env
# Fill in GROQ_API_KEY and APEX_PRIVATE_KEY

# 3. Register agents on-chain (run once)
python scripts/register_agents.py

# 4. Start backend
uvicorn api:app --reload --port 8000

# 5. Start frontend
cd frontend && npm install && npm run dev
```

## Contract Addresses (Base Sepolia)

| Registry | Address |
|---|---|
| Identity Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Reputation Registry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

## License

MIT
