"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Topbar from "@/components/dashboard/Topbar";
import FlowPipeline from "@/components/dashboard/FlowPipeline";
import DecisionBanner from "@/components/dashboard/DecisionBanner";
import AgentCard from "@/components/dashboard/AgentCard";
import VetoRow from "@/components/dashboard/VetoRow";
import LiveTerminal from "@/components/dashboard/LiveTerminal";
import { useSSE } from "@/hooks/useSSE";
import { useCycle } from "@/hooks/useCycle";
import { useReputation } from "@/hooks/useReputation";
import { fetchLog } from "@/lib/api";
import type { VetoEntry, AgentName } from "@/lib/types";

const agents: { name: AgentName; role: string; color: string; agentId: number }[] = [
  { name: "scout", role: "Market Intelligence", color: "var(--blue)", agentId: 1 },
  { name: "strategist", role: "Portfolio Optimization", color: "var(--purple)", agentId: 2 },
  { name: "guardian", role: "Risk Enforcement", color: "var(--gold)", agentId: 3 },
  { name: "executor", role: "Trade Execution", color: "var(--green)", agentId: 4 },
];

export default function DashboardPage() {
  const { events, connected } = useSSE("/api/stream");
  const { state, triggerCycle: runCycle, updateFromSSE } = useCycle();
  const [vetoLog, setVetoLog] = useState<VetoEntry[]>([]);

  // Fetch reputation for each agent
  const reputations = agents.map((a) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const rep = useReputation(BigInt(a.agentId));
    return rep;
  });

  // Process SSE events
  useEffect(() => {
    if (events.length === 0) return;
    const latest = events[events.length - 1];
    updateFromSSE(latest.type, latest.data);

    // Collect veto entries from guardian events
    if (latest.type === "guardian" && latest.data.guardian_decision === "vetoed") {
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

  // Fetch historical log on mount
  useEffect(() => {
    fetchLog()
      .then((data) => {
        const vetoes: VetoEntry[] = data.cycles
          .filter((c) => c.node === "guardian" && (c.data as Record<string, unknown>).guardian_decision === "vetoed")
          .map((c) => ({
            timestamp: c.timestamp,
            reason: (c.data.guardian_reason as string) || "unknown",
            detail: (c.data.guardian_detail as string) || "",
            confidence: Number(c.data.guardian_confidence || 0),
            txHash: (c.data.tx_hash as string) || "",
          }));
        setVetoLog(vetoes);
      })
      .catch(() => {
        // Backend offline — use empty state
      });
  }, []);

  const handleRunCycle = useCallback(async () => {
    try {
      await runCycle();
    } catch {
      // Already handled in hook
    }
  }, [runCycle]);

  const sessionMetrics = useMemo(
    () => [
      { label: "Session PnL", value: `$${state.sessionPnl.toFixed(2)}`, color: state.sessionPnl >= 0 ? "var(--green)" : "var(--red)" },
      { label: "Vetoes", value: String(state.vetoCount), color: "var(--red)" },
      { label: "Approvals", value: String(state.approvalCount), color: "var(--green)" },
      { label: "Cycle #", value: String(state.cycleNumber), color: "var(--amber)" },
    ],
    [state.sessionPnl, state.vetoCount, state.approvalCount, state.cycleNumber]
  );

  return (
    <>
      <Topbar title="Cycle Monitor" connected={connected} onRunCycle={handleRunCycle} />

      {/* Decision Banner or Flow Pipeline */}
      {state.decision ? (
        <DecisionBanner decision={state.decision} />
      ) : (
        <FlowPipeline activeNode={state.activeNode} decision={null} />
      )}

      {/* Agent Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 16,
          padding: "0 32px 32px",
        }}
      >
        {agents.map((agent, i) => (
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          padding: "0 32px 32px",
        }}
      >
        {sessionMetrics.map((m) => (
          <div
            key={m.label}
            style={{
              padding: 20,
              background: "var(--deep)",
              border: "1px solid var(--dim)",
            }}
          >
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--mid)", marginBottom: 8, textTransform: "uppercase" }}>
              {m.label}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 28,
                fontWeight: 700,
                color: m.color,
                lineHeight: 1,
              }}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Event Feed + Veto Log */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          padding: "0 32px 32px",
        }}
      >
        <LiveTerminal events={events} />

        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--mid)", textTransform: "uppercase" }}>
              Recent Vetoes
            </div>
            {vetoLog.length > 5 && (
              <a
                href="/dashboard/veto-log"
                style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)" }}
              >
                View all →
              </a>
            )}
          </div>

          {vetoLog.length === 0 ? (
            <div
              style={{
                padding: 40,
                background: "var(--deep)",
                border: "1px solid var(--dim)",
                textAlign: "center",
                fontFamily: "var(--font-display)",
                fontSize: 20,
                letterSpacing: 3,
                color: "var(--text-ghost)",
              }}
            >
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
