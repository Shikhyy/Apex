"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Topbar from "@/components/dashboard/Topbar";
import FlowPipeline from "@/components/dashboard/FlowPipeline";
import DecisionBanner from "@/components/dashboard/DecisionBanner";
import AgentCard from "@/components/dashboard/AgentCard";
import VetoRow from "@/components/dashboard/VetoRow";
import LiveTerminal from "@/components/dashboard/LiveTerminal";
import { SkeletonCard, SkeletonStat } from "@/components/ui/Skeleton";
import { useSSE } from "@/hooks/useSSE";
import { useCycle } from "@/hooks/useCycle";
import { useReputation } from "@/hooks/useReputation";
import { fetchHealth, fetchLog } from "@/lib/api";
import type { VetoEntry, AgentName } from "@/lib/types";
import { useAccount, useWriteContract } from "wagmi";
import { ADDRESSES, RISK_ROUTER_ABI } from "@/lib/contracts";
import { parseUnits } from "viem";

const agents: { name: AgentName; role: string; color: string; agentId: number }[] = [
  { name: "scout", role: "Market Intelligence", color: "var(--apex-cream)", agentId: 1 },
  { name: "strategist", role: "Portfolio Optimization", color: "var(--apex-burn)", agentId: 2 },
  { name: "guardian", role: "Risk Enforcement", color: "var(--apex-dark-red)", agentId: 3 },
  { name: "executor", role: "Trade Execution", color: "var(--apex-burn)", agentId: 4 },
];

function useAllReputations() {
  const scout = useReputation(BigInt(1));
  const strategist = useReputation(BigInt(2));
  const guardian = useReputation(BigInt(3));
  const executor = useReputation(BigInt(4));
  return [scout, strategist, guardian, executor];
}

type AgentSignal = {
  headline: string;
  detail: string;
  statusLabel: string;
  eventCount: number;
};

type ActionStatus = {
  kind: "idle" | "info" | "success" | "error";
  message: string;
};

function formatUsd(value: number): string {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function summarizeAgentSignal(
  agentName: AgentName,
  events: ReturnType<typeof useSSE>["events"],
  state: ReturnType<typeof useCycle>["state"]
): AgentSignal {
  const agentEvents = events.filter((event) => event.type === agentName);
  const latest = agentEvents.at(-1);

  if (agentName === "scout") {
    const opportunitiesCount = Number(
      latest?.data.opportunities_count ??
      (((latest?.data.opportunities as unknown[] | undefined) || []).length)
    );
    const volatility = Number(latest?.data.volatility_index ?? 0);
    const sentiment = Number(latest?.data.sentiment_score ?? 0);
    return {
      headline: `${opportunitiesCount} opportunities mapped`,
      detail: `Volatility ${volatility.toFixed(1)} | Sentiment ${sentiment.toFixed(2)}`,
      statusLabel: state.activeNode === "scout" ? "SCANNING" : agentEvents.length > 0 ? "COMPLETE" : "STANDBY",
      eventCount: agentEvents.length,
    };
  }

  if (agentName === "strategist") {
    const intentsCount = Number(
      latest?.data.ranked_intents_count ??
      (((latest?.data.ranked_intents as unknown[] | undefined) || []).length)
    );
    return {
      headline: `${intentsCount} ranked intents`,
      detail: state.activeNode === "strategist" ? "Optimizing capital allocation" : "Awaiting scout output",
      statusLabel: state.activeNode === "strategist" ? "RANKING" : agentEvents.length > 0 ? "COMPLETE" : "STANDBY",
      eventCount: agentEvents.length,
    };
  }

  if (agentName === "guardian") {
    const guardianDecision =
      String(latest?.data.guardian_decision || "").toUpperCase() ||
      (state.decision?.approved === undefined ? "VETOED" : state.decision.approved ? "APPROVED" : "VETOED");
    const decision = guardianDecision.toUpperCase();
    const reason = String(latest?.data.guardian_reason || state.decision?.reason || "awaiting signal");
    const detail = String(latest?.data.guardian_detail || state.decision?.detail || "Risk checks in progress");
    return {
      headline: decision === "APPROVED" ? "Trade cleared" : "Circuit breaker armed",
      detail: `${reason} · ${detail}`,
      statusLabel: state.activeNode === "guardian" ? (decision === "APPROVED" ? "APPROVING" : "CHECKING") : decision === "APPROVED" ? "COMPLETE" : "VETOED",
      eventCount: agentEvents.length,
    };
  }

  const executedProtocol = String(latest?.data.executed_protocol || "");
  const txHash = String(latest?.data.tx_hash || state.txHash || "");
  const pnl = Number(latest?.data.actual_pnl ?? state.sessionPnl ?? 0);
  const executionError = String(latest?.data.execution_error || "");
  return {
    headline: executionError ? "Execution blocked" : executedProtocol ? `${executedProtocol} deployed` : "Ready to execute",
    detail: executionError
      ? executionError
      : txHash
      ? `${formatUsd(pnl)} realized PnL | ${txHash.slice(0, 12)}…`
      : "Waiting for an approved intent",
    statusLabel: executionError ? "ERROR" : state.activeNode === "executor" ? "EXECUTING" : agentEvents.length > 0 ? "COMPLETE" : "STAGED",
    eventCount: agentEvents.length,
  };
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync, isPending: isSubmittingTrade } = useWriteContract();
  const walletAddress = address?.toLowerCase();
  const configuredApiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";
  const streamUrl = isConnected && walletAddress
    ? configuredApiBase
      ? `${configuredApiBase}/stream?user_wallet=${encodeURIComponent(walletAddress)}`
      : `/api/stream?user_wallet=${encodeURIComponent(walletAddress)}`
    : null;
  const { events, connected } = useSSE(streamUrl);
  const { state, updateFromSSE, resetState } = useCycle();
  const [vetoLog, setVetoLog] = useState<VetoEntry[]>([]);
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [automationRunning, setAutomationRunning] = useState(false);
  const [actionStatus, setActionStatus] = useState<ActionStatus>({ kind: "idle", message: "" });
  const [lastHandledIntentHash, setLastHandledIntentHash] = useState<string>("");
  const reputations = useAllReputations();
  const riskRouterConfigured = Boolean(ADDRESSES.riskRouter);

  const dataLoaded = reputations.every((r) => !r.loading);
  const liveSignals = useMemo(
    () =>
      agents.map((agent, index) => ({
        ...agent,
        signal: summarizeAgentSignal(agent.name, events, state),
        reputation: reputations[index].summary?.normalized ?? 0,
      })),
    [events, reputations, state]
  );

  const cycleHealth = useMemo(
    () => [
      {
        label: "Connection",
        value: connected ? "LIVE" : "OFFLINE",
        color: connected ? "var(--green)" : "var(--red)",
      },
      {
        label: "Cycle",
        value: state.status.toUpperCase(),
        color: state.status === "running" ? "var(--apex-burn)" : "var(--muted)",
      },
      {
        label: "Active Node",
        value: state.activeNode ? state.activeNode.toUpperCase() : "STANDBY",
        color: "var(--apex-cream)",
      },
      {
        label: "Stream Events",
        value: String(events.length),
        color: "var(--apex-burn)",
      },
    ],
    [connected, events.length, state.activeNode, state.status]
  );

  useEffect(() => {
    if (events.length === 0) return;
    const latest = events[events.length - 1];
    updateFromSSE(latest.type, latest.data);

    if (latest.type === "guardian" && String(latest.data.guardian_decision).toUpperCase() === "VETOED") {
      setVetoLog((prev) => [
        {
          timestamp: latest.timestamp,
          reason: (latest.data.guardian_reason as string) || "unknown",
          detail: (latest.data.guardian_detail as string) || "",
          confidence: Number(latest.data.guardian_confidence || 0),
          txHash: (latest.data.tx_hash as string) || "",
        },
        ...prev,
      ]);
    }
  }, [events, updateFromSSE]);

  useEffect(() => {
    if (!walletAddress) {
      setVetoLog([]);
      return;
    }

    fetchLog(walletAddress)
      .then((data) => {
        const vetoes: VetoEntry[] = data.cycles
          .filter((c) => c.node === "guardian" && String((c.data as Record<string, unknown>).guardian_decision).toUpperCase() === "VETOED")
          .map((c) => ({
            timestamp: c.timestamp,
            reason: (c.data.guardian_reason as string) || "unknown",
            detail: (c.data.guardian_detail as string) || "",
            confidence: Number(c.data.guardian_confidence || 0),
            txHash: (c.data.tx_hash as string) || "",
          }));
        setVetoLog(vetoes);
      })
      .catch(() => {});
  }, [walletAddress]);

  useEffect(() => {
    resetState();
  }, [walletAddress, resetState]);

  useEffect(() => {
    fetchHealth()
      .then((health) => {
        if (typeof health.autotrader_enabled === "boolean") {
          setAutomationEnabled(health.autotrader_enabled);
        }
        if (typeof health.autotrader_running === "boolean") {
          setAutomationRunning(health.autotrader_running);
        }
      })
      .catch(() => {
        setAutomationEnabled(true);
        setAutomationRunning(false);
      });
  }, []);

  const sessionMetrics = useMemo(
    () => [
      { label: "Session PnL", value: `$${state.sessionPnl.toFixed(2)}`, color: state.sessionPnl >= 0 ? "var(--green)" : "var(--red)" as const },
      { label: "Vetoes", value: String(state.vetoCount), color: "var(--red)" as const },
      { label: "Approvals", value: String(state.approvalCount), color: "var(--green)" as const },
      { label: "Cycle #", value: String(state.cycleNumber), color: "var(--apex-burn)" as const },
    ],
    [state.sessionPnl, state.vetoCount, state.approvalCount, state.cycleNumber]
  );

  const latestStrategistEvent = useMemo(
    () => [...events].reverse().find((event) => event.type === "strategist"),
    [events]
  );

  const latestGuardianEvent = useMemo(
    () => [...events].reverse().find((event) => event.type === "guardian"),
    [events]
  );

  const latestApprovedIntent = useMemo(() => {
    const intents = latestStrategistEvent?.data?.ranked_intents;
    if (!Array.isArray(intents) || intents.length === 0) {
      return null;
    }

    const approved =
      String(latestGuardianEvent?.data?.guardian_decision || "").toUpperCase() ===
      "APPROVED";
    if (!approved) {
      return null;
    }

    const topIntent = intents[0] as Record<string, unknown>;
    const opportunity = (topIntent.opportunity || {}) as Record<string, unknown>;
    const amountUsd = Number(topIntent.amount_usd || 0);
    const signature = String(topIntent.eip712_signature || "");
    const intentHash = String(topIntent.intent_hash || "");

    if (!opportunity.protocol || !opportunity.pool || amountUsd <= 0 || !signature || !intentHash) {
      return null;
    }

    return {
      protocol: String(opportunity.protocol),
      pool: String(opportunity.pool),
      amountUsd,
      intentHash,
      signature: signature.startsWith("0x") ? signature : `0x${signature}`,
    };
  }, [latestStrategistEvent, latestGuardianEvent]);

  const executeFromConnectedWallet = useCallback(async () => {
    if (!walletAddress) {
      setActionStatus({ kind: "error", message: "Connect wallet to execute trades." });
      return;
    }
    if (!riskRouterConfigured) {
      setActionStatus({
        kind: "error",
        message:
          "RiskRouter is not configured. Set NEXT_PUBLIC_RISK_ROUTER_ADDRESS.",
      });
      return;
    }
    if (!latestApprovedIntent) {
      setActionStatus({
        kind: "error",
        message:
          "No approved intent available yet. Wait for Guardian APPROVED.",
      });
      return;
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const nonce = BigInt(Date.now());

    try {
      setActionStatus({
        kind: "info",
        message: "Autonomous execution submitting approved intent from connected wallet...",
      });

      const txHash = await writeContractAsync({
        address: ADDRESSES.riskRouter,
        abi: RISK_ROUTER_ABI,
        functionName: "submitTradeIntent",
        args: [
          BigInt(4),
          latestApprovedIntent.protocol,
          latestApprovedIntent.pool,
          parseUnits(latestApprovedIntent.amountUsd.toFixed(2), 18),
          deadline,
          nonce,
          BigInt(1),
          latestApprovedIntent.signature as `0x${string}`,
        ],
      });

      setActionStatus({
        kind: "success",
        message: `Autonomous wallet execution submitted: ${txHash.slice(0, 12)}...`,
      });
    } catch (error) {
      setActionStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Wallet-signed trade failed.",
      });
    }
  }, [walletAddress, riskRouterConfigured, latestApprovedIntent, writeContractAsync]);

  useEffect(() => {
    if (!walletAddress) return;
    if (!connected || state.status === "running") return;
    setActionStatus({
      kind: "info",
      message: "Autonomous backend loop is running wallet-scoped agent cycles.",
    });
  }, [walletAddress, connected, state.status]);

  useEffect(() => {
    if (!walletAddress) return;
    if (!latestApprovedIntent || isSubmittingTrade || !riskRouterConfigured) return;
    if (latestApprovedIntent.intentHash === lastHandledIntentHash) return;

    setLastHandledIntentHash(latestApprovedIntent.intentHash);
    executeFromConnectedWallet();
  }, [
    walletAddress,
    latestApprovedIntent,
    isSubmittingTrade,
    riskRouterConfigured,
    lastHandledIntentHash,
    executeFromConnectedWallet,
  ]);

  return (
    <>
      <Topbar
        title="Cycle Monitor"
        connected={isConnected && connected}
        automationEnabled={automationEnabled}
        automationRunning={automationRunning}
      />

      <main style={{ padding: "24px 32px 40px", position: "relative" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)",
            opacity: 0.2,
          }}
        />

        <section
          style={{
            position: "relative",
            marginBottom: 24,
            padding: 28,
            border: "1px solid var(--dim)",
            background: "linear-gradient(135deg, rgba(17,17,17,0.96), rgba(10,10,10,0.98))",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(700px 240px at 20% 0%, rgba(213,62,15,0.18), transparent 60%), radial-gradient(500px 180px at 100% 0%, rgba(237,217,185,0.08), transparent 52%)",
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 24, alignItems: "start" }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 4, color: "var(--apex-burn)", textTransform: "uppercase", marginBottom: 10 }}>
                Mission Control
              </div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 62, lineHeight: 0.9, letterSpacing: 3, color: "var(--white)", marginBottom: 16 }}>
                Live capital orchestration.
              </h2>
              <p style={{ maxWidth: 760, fontFamily: "var(--font-sans)", fontSize: 15, lineHeight: 1.8, color: "var(--muted)" }}>
                Connected wallet execution, reputation-gated approvals, and on-chain vetoes are streamed here as a single control surface.
                The layout reacts to the current cycle instead of sitting as a static dashboard.
              </p>
              {walletAddress ? (
                <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
                  <div
                    style={{
                      padding: "10px 14px",
                      border: "1px solid rgba(232, 255, 0, 0.45)",
                      background: "rgba(232, 255, 0, 0.14)",
                      color: "var(--apex-cream)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                    }}
                  >
                    Autonomous Wallet Agent Pipeline Active
                  </div>
                </div>
              ) : null}
              {walletAddress && actionStatus.kind !== "idle" ? (
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 12px",
                    border: "1px solid var(--dim)",
                    background:
                      actionStatus.kind === "success"
                        ? "rgba(52, 211, 153, 0.14)"
                        : actionStatus.kind === "error"
                        ? "rgba(248, 113, 113, 0.14)"
                        : "rgba(213, 62, 15, 0.14)",
                    color:
                      actionStatus.kind === "success"
                        ? "var(--green)"
                        : actionStatus.kind === "error"
                        ? "var(--red)"
                        : "var(--apex-burn)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                  }}
                >
                  {actionStatus.message}
                </div>
              ) : null}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
              {cycleHealth.map((metric) => (
                <div key={metric.label} style={{ padding: 16, border: "1px solid var(--dim)", background: "rgba(255,255,255,0.02)" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: 2, color: "var(--mid)", textTransform: "uppercase", marginBottom: 8 }}>
                    {metric.label}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: metric.color, letterSpacing: 1 }}>
                    {metric.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {!walletAddress ? (
          <section
            style={{
              marginTop: 24,
              marginBottom: 24,
              padding: 24,
              border: "1px solid rgba(232, 255, 0, 0.35)",
              background: "rgba(232, 255, 0, 0.06)",
            }}
          >
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--apex-burn)", textTransform: "uppercase", marginBottom: 10 }}>
              Wallet Required
            </div>
            <p style={{ fontFamily: "var(--font-sans)", color: "var(--white)", margin: 0, lineHeight: 1.7 }}>
              Connect your wallet to load your personal cycle history, trade events, and PnL. Dashboard data is scoped per connected wallet.
            </p>
          </section>
        ) : null}

        {walletAddress && state.decision ? <DecisionBanner decision={state.decision} /> : null}

        {walletAddress ? <FlowPipeline activeNode={state.activeNode} decision={state.decision} cycleStatus={state.status} /> : null}

        {walletAddress ? <section style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, marginTop: 24 }}>
          {!dataLoaded
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : liveSignals.map((agent, index) => (
                <AgentCard
                  key={agent.name}
                  name={agent.name}
                  role={agent.role}
                  color={agent.color}
                  repScore={reputations[index].summary?.normalized ?? 0}
                  agentId={agent.agentId}
                  isActive={state.activeNode === agent.name}
                  headline={agent.signal.headline}
                  pnl={agent.name === "executor" ? state.sessionPnl : undefined}
                  lastDecision={
                    state.decision && state.activeNode === agent.name
                      ? state.decision.approved
                        ? "Approved"
                        : "Vetoed"
                      : undefined
                  }
                  statusLabel={agent.signal.statusLabel}
                  detail={agent.signal.detail}
                  eventCount={agent.signal.eventCount}
                />
              ))}
        </section> : null}

        {walletAddress ? <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, marginTop: 24 }}>
          {!dataLoaded
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonStat key={i} />)
            : sessionMetrics.map((m) => (
                <div key={m.label} style={{ padding: 20, background: "var(--deep)", border: "1px solid var(--dim)" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--mid)", marginBottom: 8, textTransform: "uppercase" }}>
                    {m.label}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 700, color: m.color, lineHeight: 1 }}>{m.value}</div>
                </div>
              ))}
        </section> : null}

        {walletAddress ? <section style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 24, marginTop: 24 }}>
          <LiveTerminal events={events} />

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--mid)", textTransform: "uppercase" }}>
                Recent Vetoes
              </div>
              {vetoLog.length > 5 && (
                <a href="/dashboard/veto-log" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--apex-burn)" }}>
                  View all →
                </a>
              )}
            </div>

            {vetoLog.length === 0 ? (
              <div style={{ padding: 40, background: "var(--deep)", border: "1px solid var(--dim)", textAlign: "center", fontFamily: "var(--font-display)", fontSize: 20, letterSpacing: 3, color: "var(--text-ghost)" }}>
                NO VETOES YET
              </div>
            ) : (
              <div style={{ background: "var(--deep)", border: "1px solid var(--dim)" }}>
                {vetoLog.slice(0, 5).map((v, i) => (
                  <VetoRow key={i} {...v} />
                ))}
              </div>
            )}
          </div>
        </section> : null}
      </main>

      <style>{`
        @media (max-width: 1080px) {
          main section[style*="grid-template-columns: repeat(2, minmax(0, 1fr))"] {
            grid-template-columns: 1fr !important;
          }
          main section[style*="grid-template-columns: 1.15fr 0.85fr"] {
            grid-template-columns: 1fr !important;
          }
          main section[style*="grid-template-columns: repeat(4, minmax(0, 1fr))"] {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 768px) {
          main {
            padding: 16px !important;
          }
          h2 {
            font-size: 42px !important;
          }
          main section[style*="grid-template-columns: repeat(4, minmax(0, 1fr))"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}
