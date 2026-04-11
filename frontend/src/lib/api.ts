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
  return request<{
    status: string;
    autotrader_enabled?: boolean;
    autotrader_running?: boolean;
  }>("/health");
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

export async function fetchLog(userWallet?: string) {
  const params = new URLSearchParams();
  if (userWallet) params.set("user_wallet", userWallet.toLowerCase());
  const path = params.toString() ? `/log?${params.toString()}` : "/log";

  const raw = await request<{
    cycles: Array<Record<string, unknown>>;
  }>(path);

  const cycles = (raw.cycles || []).map((row) => {
    const nestedData = row.data;
    if (nestedData && typeof nestedData === "object" && !Array.isArray(nestedData)) {
      return {
        node: String(row.node || ""),
        timestamp: String(row.timestamp || ""),
        data: nestedData as Record<string, unknown>,
      };
    }

    // Supabase-backed rows are flattened; normalize into the .data shape used by UI.
    const data: Record<string, unknown> = {
      guardian_decision: row.guardian_decision,
      guardian_reason: row.guardian_reason,
      guardian_detail: row.guardian_detail,
      guardian_confidence: row.guardian_confidence,
      tx_hash: row.tx_hash,
      executed_protocol: row.executed_protocol,
      actual_pnl: row.actual_pnl,
      execution_error: row.execution_error,
      session_pnl: row.session_pnl,
      veto_count: row.veto_count,
      approval_count: row.approval_count,
      cycle_number: row.cycle_number,
      protocol: row.protocol,
      amount_usd: row.amount_usd,
    };

    return {
      node: String(row.node || ""),
      timestamp: String(row.timestamp || ""),
      data,
    };
  });

  return { cycles };
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
