const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export async function fetchHealth() {
  return request<{ status: string }>("/health");
}

export async function fetchAgents() {
  return request<{
    agents: Array<{ name: string; agent_id: number; role: string }>;
    network: string;
    identity_registry: string;
  }>("/agents");
}

export async function fetchReputation(agentId: number) {
  return request<{
    agent_id: number;
    avg_score: number;
    normalized: number;
    count: number;
    signals: Array<{
      reviewer: number;
      score: number;
      evidenceURI: string;
      block: number;
      txHash: string;
    }>;
  }>(`/reputation/${agentId}`);
}

export async function fetchLog() {
  return request<{
    cycles: Array<{
      node: string;
      timestamp: string;
      data: Record<string, unknown>;
    }>;
  }>("/log");
}

export async function triggerCycle() {
  return request<{ cycle: number }>("/cycle", { method: "POST" });
}

export async function fetchMarketPrices() {
  return request<{
    prices: Array<{
      symbol: string;
      price: number;
      change_24h: number;
      timestamp: string;
    }>;
  }>("/market/prices");
}

export async function fetchMarketSignals() {
  return request<{
    signals: Array<{
      symbol: string;
      signal: "BULLISH" | "BEARISH" | "NEUTRAL";
      confidence: number;
      reasoning: string;
    }>;
  }>("/market/signals");
}

export async function fetchAerodromePools() {
  return request<{
    pools: Array<{
      pool: string;
      protocol: string;
      tvl_usd: number;
      apy: number;
      risk_score: number;
      liquidity_usd: number;
    }>;
  }>("/market/aerodrome-pools");
}
