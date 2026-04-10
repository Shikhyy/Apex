"use client";

import { useState, useEffect, useMemo } from "react";
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

export default function DashboardPage() {
  const { events, connected } = useSSE("/api/stream");
  const { state, updateFromSSE } = useCycle();
  const [vetoLog, setVetoLog] = useState<VetoEntry[]>([]);
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [automationRunning, setAutomationRunning] = useState(false);
  const reputations = useAllReputations();

  const dataLoaded = reputations.every((r) => !r.loading);

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
    fetchLog()
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
  }, []);

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

  return (
    <>
      <Topbar
        title="Cycle Monitor"
        connected={connected}
        automationEnabled={automationEnabled}
        automationRunning={automationRunning}
      />

      {state.decision ? (
        <DecisionBanner decision={state.decision} />
      ) : (
        <FlowPipeline activeNode={state.activeNode} decision={null} />
      )}

      {/* Agent Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, padding: "0 32px 32px" }}>
        {!dataLoaded
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : agents.map((agent, i) => (
              <AgentCard
                key={agent.name}
                name={agent.name}
                role={agent.role}
                color={agent.color}
                repScore={reputations[i].summary?.normalized ?? 0}
                agentId={agent.agentId}
                isActive={state.activeNode === agent.name}
                lastDecision={
                  state.decision && state.activeNode === agent.name
                    ? state.decision.approved
                      ? "Approved"
                      : "Vetoed"
                    : undefined
                }
              />
            ))}
      </div>

      {/* Session Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, padding: "0 32px 32px" }}>
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
      </div>

      {/* Event Feed + Veto Log */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, padding: "0 32px 32px" }}>
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
      </div>

      <style>{`
        @media (max-width: 1024px) {
          div[style*="grid-template-columns: repeat(2"] { grid-template-columns: 1fr !important; }
          div[style*="grid-template-columns: repeat(4"] { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 768px) {
          div[style*="grid-template-columns: repeat(4"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
