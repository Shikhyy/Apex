export type AgentName = "scout" | "strategist" | "guardian" | "executor";

export interface AgentInfo {
  name: AgentName;
  agentId: number;
  role: string;
  color: string;
}

export interface GuardianDecision {
  approved: boolean;
  reason: string;
  confidence: number;
  detail: string;
  txHash?: string;
}

export interface SSEEvent {
  type: "scout" | "strategist" | "guardian" | "executor" | "veto" | "done";
  timestamp: string;
  data: Record<string, unknown>;
}

export interface ReputationSummary {
  count: number;
  value: number;
  decimals: number;
  normalized: number;
}

export interface FeedbackEntry {
  value: bigint;
  valueDecimals: number;
  tag1: string;
  tag2: string;
  isRevoked: boolean;
}

export interface YieldOpportunity {
  protocol: string;
  pool: string;
  apy: number;
  tvl_usd: number;
  risk_score: number;
  liquidity_usd: number;
}

export interface TradeIntent {
  opportunity: YieldOpportunity;
  amount_usd: number;
  expected_pnl: number;
  confidence: number;
  eip712_signature: string;
  intent_hash: string;
}

export interface VetoEntry {
  timestamp: string;
  reason: string;
  detail: string;
  confidence: number;
  txHash: string;
  ipfsHash?: string;
}

export interface CycleState {
  status: "idle" | "running" | "complete";
  cycleNumber: number;
  activeNode: AgentName | null;
  decision: GuardianDecision | null;
  txHash: string | null;
  sessionPnl: number;
  vetoCount: number;
  approvalCount: number;
}
