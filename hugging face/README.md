---
title: APEX Backend
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

# APEX on Hugging Face Spaces (Docker)

This folder contains the deployment assets for running the APEX FastAPI backend on Hugging Face Spaces.

## What this deploys

- FastAPI backend from `api.py`
- Uvicorn server bound to `0.0.0.0:7860` (required for Spaces)

## Deploy Steps

1. Create a new Hugging Face Space.
2. Choose `Docker` as the SDK.
3. Push this repository to the Space.
4. In Space settings, add required Secrets (environment variables).
5. Rebuild the Space.

## Required Secrets

Set these in Space Settings -> Variables and Secrets:

- `GROQ_API_KEY`
- `APEX_PRIVATE_KEY`
- `APEX_SCOUT_AGENT_ID`
- `APEX_STRATEGIST_AGENT_ID`
- `APEX_GUARDIAN_AGENT_ID`
- `APEX_EXECUTOR_AGENT_ID`

## Optional but recommended Secrets

- `BASE_SEPOLIA_RPC`
- `RISK_ROUTER_ADDRESS`
- `SURGE_API_KEY`
- `SURGE_VAULT_ADDRESS`
- `KRAKEN_API_KEY`
- `KRAKEN_API_SECRET`
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `CORS_ALLOW_ORIGINS` (comma-separated, e.g. `https://your-space-name.hf.space`)

## Runtime checks

After deployment, verify:

- `/health` returns healthy status
- `/stream` emits SSE events
- `/cycle` can trigger one cycle

## Notes

- The Dockerfile expects repo-root build context and runs `uvicorn api:app`.
- If your frontend calls this API directly, set `CORS_ALLOW_ORIGINS` to your Hugging Face Space URL.
