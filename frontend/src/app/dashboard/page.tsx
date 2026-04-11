"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Topbar from "@/components/dashboard/Topbar";
import FlowPipeline from "@/components/dashboard/FlowPipeline";
import DecisionBanner from "@/components/dashboard/DecisionBanner";
import AgentCard from "@/components/dashboard/AgentCard";
import VetoRow from "@/components/dashboard/VetoRow";
import LiveTerminal from "@/components/dashboard/LiveTerminal";
import AgentConversationPanel from "@/components/dashboard/AgentConversationPanel";
import { SkeletonCard, SkeletonStat } from "@/components/ui/Skeleton";
import { useSSE } from "@/hooks/useSSE";
import { useCycle } from "@/hooks/useCycle";
import { useReputation } from "@/hooks/useReputation";
import { fetchHealth, fetchLog, triggerCycle } from "@/lib/api";
import type { VetoEntry, AgentName } from "@/lib/types";

const agents: { name: AgentName; role: string; color: string; agentId: number }[] = [
  { name: "scout",      role: "Market Intelligence",  color: "#60a5fa", agentId: 1 },
  { name: "strategist", role: "Portfolio Optimization", color: "#c084fc", agentId: 2 },
  { name: "guardian",   role: "Risk Enforcement",     color: "#fbbf24", agentId: 3 },
  { name: "executor",   role: "Trade Execution",      color: "#34d399", agentId: 4 },
];

function useAllReputations() {
  const scout      = useReputation(BigInt(1));
  const strategist = useReputation(BigInt(2));
  const guardian   = useReputation(BigInt(3));
  const executor   = useReputation(BigInt(4));
  return [scout, strategist, guardian, executor];
}

type TabId = "conversation" | "terminal" | "vetoes";

export default function DashboardPage() {
  const { events, connected } = useSSE("/api/stream");
  const { state, triggerCycle: hookTriggerCycle, updateFromSSE } = useCycle();
  const [vetoLog, setVetoLog] = useState<VetoEntry[]>([]);
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [automationRunning, setAutomationRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("conversation");
  const [manualTriggerLoading, setManualTriggerLoading] = useState(false);
  const reputations = useAllReputations();

  const dataLoaded = reputations.every((r) => !r.loading);

  // Process incoming SSE events
  useEffect(() => {
    if (events.length === 0) return;
    const latest = events[events.length - 1];
    updateFromSSE(latest.type, latest.data);

    if (
      latest.type === "guardian" &&
      String(latest.data.guardian_decision).toUpperCase() === "VETOED"
    ) {
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

  // Load historical veto log
  useEffect(() => {
    fetchLog()
      .then((data) => {
        const vetoes: VetoEntry[] = data.cycles
          .filter(
            (c) =>
              c.node === "guardian" &&
              String(
                (c.data as Record<string, unknown>).guardian_decision
              ).toUpperCase() === "VETOED"
          )
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

  // Fetch health status
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

  const handleManualCycle = useCallback(async () => {
    if (state.status === "running" || manualTriggerLoading) return;
    try {
      setManualTriggerLoading(true);
      await hookTriggerCycle();
    } finally {
      setManualTriggerLoading(false);
    }
  }, [state.status, manualTriggerLoading, hookTriggerCycle]);

  const sessionMetrics = useMemo(
    () => [
      {
        label: "Session PnL",
        value: `$${state.sessionPnl.toFixed(2)}`,
        color: state.sessionPnl >= 0 ? "#34d399" : "#f87171",
        bg: state.sessionPnl >= 0 ? "#34d39910" : "#f8717110",
      },
      { label: "Cycle #", value: String(state.cycleNumber), color: "#c084fc", bg: "#c084fc10" },
      { label: "Approvals", value: String(state.approvalCount), color: "#34d399", bg: "#34d39910" },
      { label: "Vetoes", value: String(state.vetoCount), color: "#f87171", bg: "#f8717110" },
    ],
    [state.sessionPnl, state.vetoCount, state.approvalCount, state.cycleNumber]
  );

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "conversation", label: "Agent Flow", count: events.length },
    { id: "terminal", label: "Raw Stream" },
    { id: "vetoes", label: "Vetoes", count: vetoLog.length },
  ];

  return (
    <>
      <Topbar
        title="Cycle Monitor"
        connected={connected}
        automationEnabled={automationEnabled}
        automationRunning={automationRunning}
      />

      {/* Flow Pipeline — always visible */}
      <FlowPipeline
        activeNode={state.activeNode}
        decision={state.decision}
        cycleStatus={state.status}
      />

      {/* Decision Banner overlay */}
      {state.decision && <DecisionBanner decision={state.decision} />}

      {/* Session Metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 1,
          background: "#111",
          borderBottom: "1px solid #1e1e1e",
        }}
      >
        {!dataLoaded
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ padding: 20, background: "#0d0d0d" }}>
                <SkeletonStat />
              </div>
            ))
          : sessionMetrics.map((m) => (
              <div
                key={m.label}
                style={{
                  padding: "20px 24px",
                  background: "#0d0d0d",
                  borderRight: "1px solid #111",
                  transition: "background 300ms",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    letterSpacing: 2,
                    color: "#444",
                    marginBottom: 8,
                    textTransform: "uppercase",
                  }}
                >
                  {m.label}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 26,
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

      {/* Main content area */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: 0,
          minHeight: "calc(100vh - 340px)",
        }}
      >
        {/* Left: Agent Cards + Tabbed Panel */}
        <div style={{ borderRight: "1px solid #111", display: "flex", flexDirection: "column" }}>
          {/* Agent Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 1,
              background: "#111",
              borderBottom: "1px solid #1e1e1e",
            }}
          >
            {!dataLoaded
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ background: "#0d0d0d", padding: 20 }}>
                    <SkeletonCard />
                  </div>
                ))
              : agents.map((agent, i) => (
                  <AgentCard
                    key={agent.name}
                    name={agent.name}
                    role={agent.role}
                    color={agent.color}
                    repScore={reputations[i].summary?.normalized ?? 50}
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

          {/* Tabs */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid #1e1e1e",
              background: "#0a0a0a",
            }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "12px 20px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: activeTab === tab.id ? "#D53E0F" : "#444",
                  borderBottom: activeTab === tab.id ? "2px solid #D53E0F" : "2px solid transparent",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  transition: "color 200ms",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    style={{
                      background: activeTab === tab.id ? "#D53E0F22" : "#1a1a1a",
                      color: activeTab === tab.id ? "#D53E0F" : "#444",
                      fontFamily: "var(--font-mono)",
                      fontSize: 8,
                      padding: "1px 5px",
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}

            {/* Cycle trigger / Autonomous mode badge */}
            {automationEnabled ? (
              <div
                style={{
                  marginLeft: "auto",
                  padding: "10px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: "#34d399",
                  background: "rgba(52,211,153,0.08)",
                  border: "1px solid #34d39944",
                  marginTop: 8,
                  marginBottom: 8,
                  marginRight: 16,
                  cursor: "default",
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "999px",
                    background: "#34d399",
                    animation: state.status === "running" ? "pulse 1.2s infinite" : "none",
                  }}
                />
                Autonomous Mode
              </div>
            ) : (
              <button
                onClick={handleManualCycle}
                disabled={state.status === "running" || manualTriggerLoading}
                style={{
                  marginLeft: "auto",
                  padding: "10px 20px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color:
                    state.status === "running" || manualTriggerLoading
                      ? "#333"
                      : "#D53E0F",
                  background:
                    state.status === "running" || manualTriggerLoading
                      ? "transparent"
                      : "rgba(213,62,15,0.08)",
                  border: `1px solid ${
                    state.status === "running" || manualTriggerLoading
                      ? "#222"
                      : "#D53E0F44"
                  }`,
                  cursor:
                    state.status === "running" || manualTriggerLoading
                      ? "not-allowed"
                      : "pointer",
                  transition: "all 200ms",
                  marginTop: 8,
                  marginBottom: 8,
                  marginRight: 16,
                }}
              >
                {state.status === "running" ? "◌ Running..." : "▶ Run Cycle"}
              </button>
            )}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            {activeTab === "conversation" && (
              <div style={{ height: "100%", overflowY: "auto" }}>
                <AgentConversationPanel events={events} />
              </div>
            )}
            {activeTab === "terminal" && (
              <div style={{ height: "100%", minHeight: 400 }}>
                <LiveTerminal events={events} />
              </div>
            )}
            {activeTab === "vetoes" && (
              <div style={{ height: "100%", overflowY: "auto" }}>
                {vetoLog.length === 0 ? (
                  <div
                    style={{
                      padding: "60px 40px",
                      textAlign: "center",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      letterSpacing: 3,
                      color: "#2a2a2a",
                    }}
                  >
                    NO VETOES YET
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 9,
                        color: "#222",
                        letterSpacing: 1,
                      }}
                    >
                      Guardian circuit breaker has not triggered
                    </div>
                  </div>
                ) : (
                  <div>
                    {vetoLog.slice(0, 20).map((v, i) => (
                      <VetoRow key={i} {...v} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Activity Feed / System Status */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            background: "#0a0a0a",
          }}
        >
          {/* System status header */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #111",
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: 2,
              color: "#333",
              textTransform: "uppercase",
            }}
          >
            System Status
          </div>

          {/* Status items */}
          <div style={{ padding: "12px 20px", borderBottom: "1px solid #0f0f0f" }}>
            <StatusRow
              label="SSE Stream"
              value={connected ? "Connected" : "Disconnected"}
              ok={connected}
            />
            <StatusRow
              label="Auto Trader"
              value={automationRunning ? "Active" : automationEnabled ? "Enabled" : "Disabled"}
              ok={automationRunning}
            />
            <StatusRow
              label="Network"
              value="Base Sepolia"
              ok={true}
            />
            <StatusRow
              label="Cycle Status"
              value={state.status.charAt(0).toUpperCase() + state.status.slice(1)}
              ok={state.status !== "idle"}
            />
          </div>

          {/* Recent activity summary */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #111",
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: 2,
              color: "#333",
              textTransform: "uppercase",
            }}
          >
            Agents ({agents.length} active)
          </div>

          <div style={{ padding: "8px 0" }}>
            {agents.map((agent) => {
              const isActive = state.activeNode === agent.name;
              return (
                <div
                  key={agent.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 20px",
                    borderBottom: "1px solid #0f0f0f",
                    background: isActive ? `${agent.color}08` : "transparent",
                    transition: "background 300ms",
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "999px",
                      background: isActive ? agent.color : "#1e1e1e",
                      animation: isActive ? "pulse 1.2s infinite" : "none",
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        color: isActive ? agent.color : "#555",
                        letterSpacing: 1,
                      }}
                    >
                      {agent.name.toUpperCase()}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 9,
                        color: "#333",
                      }}
                    >
                      {isActive ? "Processing..." : agent.role}
                    </div>
                  </div>
                  <div
                    style={{
                      marginLeft: "auto",
                      fontFamily: "var(--font-mono)",
                      fontSize: 8,
                      color: isActive ? agent.color : "#222",
                      letterSpacing: 1,
                    }}
                  >
                    ERC-8004 #{agent.agentId}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recent decisions */}
          {state.decision && (
            <div style={{ padding: "16px 20px", marginTop: 8 }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: 2,
                  color: "#333",
                  marginBottom: 12,
                  textTransform: "uppercase",
                }}
              >
                Latest Decision
              </div>
              <div
                style={{
                  padding: 16,
                  background: state.decision.approved
                    ? "#34d39910"
                    : "#f8717110",
                  border: `1px solid ${
                    state.decision.approved ? "#34d39933" : "#f8717133"
                  }`,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: state.decision.approved ? "#34d399" : "#f87171",
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  {state.decision.approved ? "✓ APPROVED" : "⊘ VETOED"}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "#555",
                    marginBottom: 4,
                  }}
                >
                  {state.decision.reason.replace(/_/g, " ")}
                </div>
                {state.decision.detail && (
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      color: "#444",
                    }}
                  >
                    {state.decision.detail.slice(0, 100)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 1200px) {
          div[style*="grid-template-columns: 1fr 340px"] {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 900px) {
          div[style*="grid-template-columns: repeat(2, 1fr)"] {
            grid-template-columns: 1fr !important;
          }
          div[style*="grid-template-columns: repeat(4, 1fr)"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 600px) {
          div[style*="grid-template-columns: repeat(4, 1fr)"] {
            grid-template-columns: 1fr !important;
          }
        }
        button:hover:not(:disabled) {
          opacity: 0.85;
        }
      `}</style>
    </>
  );
}

function StatusRow({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 0",
        borderBottom: "1px solid #0f0f0f",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "#444",
          letterSpacing: 1,
        }}
      >
        {label}
      </span>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: ok ? "#34d399" : "#f87171",
        }}
      >
        <span
          style={{
            width: 4,
            height: 4,
            borderRadius: "999px",
            background: ok ? "#34d399" : "#f87171",
            display: "inline-block",
            animation: ok ? "pulse 2s infinite" : "none",
          }}
        />
        {value}
      </span>
    </div>
  );
}
