# APEX Frontend

> Terminal-grade dark intelligence — monopo.vn aesthetic

<p align="center">
  <img src="public/favicon.svg" alt="APEX Logo" width="64" height="64" />
</p>

## Overview

The APEX frontend is a Next.js 15 App Router application with a marketing site, live dashboard, and protocol documentation — all sharing a unified design language inspired by high-end creative studio sites.

## Stack

- **Framework:** Next.js 15 · React 19 · TypeScript
- **Styling:** Scoped CSS (no Tailwind) — brutalist, zero border-radius
- **Fonts:** Bebas Neue (display) · DM Mono (data/labels) · DM Sans (body)
- **Animations:** Framer Motion + CSS keyframes
- **Charts:** Recharts 3
- **Blockchain:** viem 2 · wagmi 2 · RainbowKit 2
- **State:** Custom hooks (useSSE, useReputation, useCycle)

## Pages

| Route | Description |
|-------|-------------|
| `/` | Marketing landing — hero, marquee, agents, veto, terminal, stack, CTA |
| `/dashboard` | Live cycle monitor — FlowPipeline, agent cards, SSE feed, veto log |
| `/dashboard/agents` | Agent registry — on-chain wallet resolution, feedback table |
| `/dashboard/veto-log` | Veto history — filterable table, stats, CSV export |
| `/dashboard/portfolio` | Portfolio & yield — PnL chart, positions, trade history |
| `/dashboard/settings` | Configuration — thresholds, API keys, models, network |
| `/docs` | Protocol documentation — architecture, API reference, setup guide |

## Design System

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--void` | `#0a0a0a` | Background |
| `--white` | `#f0ede8` | Primary text |
| `--amber` | `#e8ff00` | Primary accent |
| `--blue` | `#60a5fa` | Scout |
| `--purple` | `#a78bfa` | Strategist |
| `--gold` | `#f59e0b` | Guardian |
| `--green` | `#34d399` | Executor / positive |
| `--red` | `#f87171` | Veto / negative |

### Key Interactions

- **Hero title reveal** — 3 lines slide up with 100ms stagger
- **Loader counter** — non-linear 0→100, amber progress bar, 1.8s
- **Custom cursor** — 12px amber dot + 40px lagging ring, mix-blend-mode: difference
- **3D tilt cards** — perspective(600px) follows cursor, snaps back on leave
- **Terminal line reveal** — opacity 0→1 + translateX, 80ms stagger
- **Rep score ring** — SVG arc draws from 0 to score over 1.2s

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Lint
npm run lint
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_BASE_SEPOLIA_RPC=https://sepolia.base.org
NEXT_PUBLIC_IDENTITY_REGISTRY=0xE6fC2495eE4207d4D8444D03D2418566e4234A36
NEXT_PUBLIC_REPUTATION_REGISTRY=0xeC6a0e1aB27882e222200F89D17F76ED8413C9268
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

## Contract Integration

The frontend reads on-chain data directly via viem public client:

- **IdentityRegistry** — `getAgentWallet()`, `getMetadata()`, `totalAgents()`, `tokenURI()`
- **ReputationRegistry** — `getSummary()`, `readFeedback()`, `getClients()`

ABIs are extracted from `contracts/out/` build artifacts and stored in `src/lib/contracts.ts`.

## Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Marketing landing
│   ├── dashboard/          # Dashboard pages
│   ├── docs/               # Documentation
│   └── api/stream/         # SSE proxy
├── components/
│   ├── ui/                 # Primitives
│   ├── marketing/          # Landing sections
│   ├── dashboard/          # Dashboard components
│   └── shared/             # Logo, Nav, Footer
├── hooks/                  # Custom hooks
├── lib/                    # viem, contracts, API
└── styles/                 # Design system CSS
```
