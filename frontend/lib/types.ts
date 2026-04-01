export interface YieldOpportunity {
  protocol: string
  pool: string
  apy: number
  tvl_usd: number
  risk_score: number
  liquidity_usd: number
}

export interface TradeIntent {
  opportunity: YieldOpportunity
  amount_usd: number
  expected_pnl: number
  confidence: number
  eip712_signature: string
  intent_hash: string
}

export type GuardianReason =
  | "volatility_spike"
  | "drawdown_limit"
  | "low_scout_reputation"
  | "suspicious_apy"
  | "low_liquidity"
  | "negative_sentiment"
  | "uncertainty"
  | "safe_to_proceed"
  | "no_opportunities"

export type AgentName = "scout" | "strategist" | "guardian" | "executor"

export interface AgentInfo {
  name: AgentName
  agent_id: number
  role: string
}

export interface SSEEvent {
  node: string
  timestamp: string
  data: Record<string, unknown>
}

export interface ReputationResponse {
  agent_id: number
  avg_score: number
  normalized: number
  count: number
  signals: {
    reviewer: number
    score: number
    evidenceURI: string
    block: number
    txHash: string
  }[]
}

export interface AgentsResponse {
  agents: AgentInfo[]
  network: string
  identity_registry: string
}

export interface LogResponse {
  cycles: {
    node: string
    timestamp: string
    data: Record<string, unknown>
  }[]
}
