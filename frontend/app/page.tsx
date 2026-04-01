"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import type { SSEEvent, AgentInfo, AgentName } from "@/lib/types"
import { fetchAgents, fetchHealth, triggerCycle } from "@/lib/api"

const AGENT_COLORS: Record<AgentName, string> = {
  scout: "#60a5fa",
  strategist: "#a78bfa",
  guardian: "#f59e0b",
  executor: "#34d399",
}

const AGENT_LABELS: Record<AgentName, string> = {
  scout: "SCOUT",
  strategist: "STRATEGIST",
  guardian: "GUARDIAN",
  executor: "EXECUTOR",
}

interface AgentCardProps {
  name: AgentName
  status: "ready" | "running" | "idle" | "error"
  repScore: number
  agentId: number
}

function AgentCard({ name, status, repScore, agentId }: AgentCardProps) {
  const color = AGENT_COLORS[name]
  const pct = Math.round(repScore * 100)
  const isRunning = status === "running"

  return (
    <div
      className="agent-card"
      style={{
        background: "var(--bg-deep)",
        border: `1px solid ${isRunning ? color : "var(--border-default)"}`,
        borderRadius: 4,
        padding: 14,
        marginBottom: 8,
        boxShadow: isRunning ? `0 0 16px ${color}40` : "none",
        transition: "all 0.3s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: status === "error" ? "#f87171" : isRunning ? color : "var(--text-muted)",
              display: "inline-block",
              animation: isRunning ? "pulse 1.5s ease infinite" : "none",
            }}
          />
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11, color }}>
            {AGENT_LABELS[name]}
          </span>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>
          #{agentId || "—"}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div
          style={{
            flex: 1,
            height: 4,
            background: "var(--bg-overlay)",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            className="rep-bar-fill"
            style={{
              width: `${pct}%`,
              height: "100%",
              background: color,
              borderRadius: 2,
              transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, color: "var(--text-secondary)" }}>
          {pct}%
        </span>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>
        {status}
      </div>
    </div>
  )
}

function FlowDiagram({ activeNode }: { activeNode: string | null }) {
  const nodes: { name: string; key: AgentName }[] = [
    { name: "SCOUT", key: "scout" },
    { name: "STRATEGIST", key: "strategist" },
    { name: "GUARDIAN", key: "guardian" },
    { name: "EXECUTOR", key: "executor" },
  ]

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 0" }}>
      {nodes.map((node, i) => (
        <div key={node.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 700,
              padding: "8px 14px",
              borderRadius: 4,
              border: `1px solid ${activeNode === node.key ? AGENT_COLORS[node.key] : "var(--border-default)"}`,
              background: activeNode === node.key ? `${AGENT_COLORS[node.key]}10` : "var(--bg-deep)",
              boxShadow: activeNode === node.key ? `0 0 16px ${AGENT_COLORS[node.key]}40` : "none",
              color: activeNode === node.key ? AGENT_COLORS[node.key] : "var(--text-muted)",
              transition: "all 0.3s ease",
            }}
          >
            {node.name}
          </div>
          {i < nodes.length - 1 && (
            <span style={{ color: "var(--border-default)", fontSize: 18, userSelect: "none" }}>→</span>
          )}
        </div>
      ))}
    </div>
  )
}

interface DecisionBannerProps {
  decision: "APPROVED" | "VETOED" | null
  txHash?: string
}

function DecisionBanner({ decision, txHash }: DecisionBannerProps) {
  if (!decision) return null

  const isVeto = decision === "VETOED"
  const borderColor = isVeto ? "#f8717140" : "#34d39940"
  const bgColor = isVeto ? "#f8717110" : "#34d39910"
  const textColor = isVeto ? "var(--vetoed)" : "var(--approved)"
  const icon = isVeto ? "🛡️" : "✅"
  const subtitle = isVeto
    ? "On-chain attestation posted to ERC-8004 Reputation Registry"
    : "Executing via Surge Risk Router + Kraken CLI"

  return (
    <div
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 4,
        padding: "14px 20px",
        marginBottom: 20,
        animation: "vetoFlash 0.4s ease both",
      }}
    >
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 16, color: textColor, marginBottom: 4 }}>
        {icon} {decision}
      </div>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--text-secondary)" }}>
        {subtitle}
        {txHash && (
          <a
            href={`https://sepolia.basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--scout)", marginLeft: 8, textDecoration: "underline" }}
          >
            BaseScan ↗
          </a>
        )}
      </div>
    </div>
  )
}

interface VetoRowData {
  timestamp: string
  reason: string
  detail: string
  confidence: number
  txHash?: string
}

function VetoRow({ timestamp, reason, detail, confidence, txHash, index }: VetoRowData & { index: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "80px 64px 1fr 2fr 48px",
        gap: 12,
        alignItems: "center",
        padding: "10px 14px",
        borderBottom: "1px solid var(--border-subtle)",
        animation: `fadeIn 0.4s ease both`,
        animationDelay: `${index * 50}ms`,
        cursor: txHash ? "pointer" : "default",
      }}
      onClick={() => {
        if (txHash) window.open(`https://sepolia.basescan.org/tx/${txHash}`, "_blank")
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.background = "#0f172a"
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.background = "transparent"
      }}
    >
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>{timestamp}</span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 700,
          color: "#f87171",
          background: "#f8717120",
          border: "1px solid #f8717140",
          borderRadius: 3,
          padding: "2px 6px",
          textAlign: "center",
        }}
      >
        VETO
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--guardian)" }}>{reason}</span>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--text-secondary)" }}>{detail}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", textAlign: "right" }}>
        {Math.round(confidence * 100)}%
      </span>
    </div>
  )
}

function StatTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        background: "var(--bg-deep)",
        border: "1px solid var(--border-default)",
        borderRadius: 4,
        padding: 14,
      }}
    >
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 20, color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>
        {label}
      </div>
    </div>
  )
}

interface EventFeedItem {
  node: string
  timestamp: string
  data: Record<string, unknown>
}

function EventFeedItemComponent({ item }: { item: EventFeedItem }) {
  const nodeKey = item.node as AgentName
  const color = AGENT_COLORS[nodeKey] || "var(--text-muted)"
  const label = AGENT_LABELS[nodeKey] || item.node.toUpperCase()
  const jsonStr = JSON.stringify(item.data)
  const truncated = jsonStr.length > 80 ? jsonStr.slice(0, 80) + "…" : jsonStr
  const time = new Date(item.timestamp).toLocaleTimeString("en-US", { hour12: false })

  return (
    <div
      style={{
        borderLeft: `2px solid ${color}`,
        paddingLeft: 12,
        marginBottom: 12,
        animation: "fadeIn 0.3s ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11, color }}>{label}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>{time}</span>
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--text-secondary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {truncated}
      </div>
    </div>
  )
}

export default function Home() {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [agentStatuses, setAgentStatuses] = useState<Record<AgentName, "ready" | "running" | "idle" | "error">>({
    scout: "ready",
    strategist: "ready",
    guardian: "ready",
    executor: "ready",
  })
  const [repScores, setRepScores] = useState<Record<AgentName, number>>({
    scout: 0,
    strategist: 0,
    guardian: 0,
    executor: 0,
  })
  const [sessionPnl, setSessionPnl] = useState(0)
  const [vetoCount, setVetoCount] = useState(0)
  const [approvalCount, setApprovalCount] = useState(0)
  const [volatilityIndex, setVolatilityIndex] = useState(0)
  const [activeNode, setActiveNode] = useState<string | null>(null)
  const [decision, setDecision] = useState<"APPROVED" | "VETOED" | null>(null)
  const [txHash, setTxHash] = useState<string | undefined>()
  const [vetoRows, setVetoRows] = useState<VetoRowData[]>([])
  const [feedItems, setFeedItems] = useState<EventFeedItem[]>([])
  const [running, setRunning] = useState(false)
  const [backendOk, setBackendOk] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    fetchHealth()
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false))

    fetchAgents()
      .then((data) => {
        setAgents(data.agents)
        const scores: Record<AgentName, number> = { scout: 0, strategist: 0, guardian: 0, executor: 0 }
        data.agents.forEach((a: AgentInfo) => {
          if (a.name in scores) scores[a.name as AgentName] = 0
        })
        setRepScores(scores)
      })
      .catch(() => {})
  }, [])

  const handleSSEMessage = useCallback((e: MessageEvent) => {
    try {
      const evt: SSEEvent = JSON.parse(e.data)
      const time = new Date(evt.timestamp).toLocaleTimeString("en-US", { hour12: false })

      setFeedItems((prev) => [{ node: evt.node, timestamp: evt.timestamp, data: evt.data }, ...prev].slice(0, 50))

      if (evt.node === "scout") {
        setActiveNode("scout")
        setAgentStatuses((p) => ({ ...p, scout: "running" }))
        if (evt.data.volatility_index != null) setVolatilityIndex(evt.data.volatility_index as number)
      } else if (evt.node === "strategist") {
        setActiveNode("strategist")
        setAgentStatuses((p) => ({ ...p, scout: "ready", strategist: "running" }))
      } else if (evt.node === "guardian") {
        setActiveNode("guardian")
        setAgentStatuses((p) => ({ ...p, strategist: "ready", guardian: "running" }))
        const d = evt.data.guardian_decision as string
        if (d === "APPROVED" || d === "VETOED") {
          setDecision(d as "APPROVED" | "VETOED")
          if (d === "VETOED") {
            setVetoCount((p) => p + 1)
            setVetoRows((prev) => [
              {
                timestamp: time,
                reason: (evt.data.guardian_reason as string) || "unknown",
                detail: (evt.data.guardian_detail as string) || "",
                confidence: (evt.data.guardian_confidence as number) || 0,
                txHash: undefined,
              },
              ...prev,
            ])
          } else {
            setApprovalCount((p) => p + 1)
          }
        }
      } else if (evt.node === "executor") {
        setActiveNode("executor")
        setAgentStatuses((p) => ({ ...p, guardian: "ready", executor: "running" }))
        const hash = evt.data.tx_hash as string
        if (hash) setTxHash(hash)
        const pnl = evt.data.actual_pnl as number
        if (pnl != null) setSessionPnl((p) => p + pnl)
      } else if (evt.node === "veto") {
        setAgentStatuses((p) => ({ ...p, guardian: "ready" }))
      } else if (evt.node === "done") {
        setActiveNode(null)
        setRunning(false)
        setAgentStatuses({ scout: "ready", strategist: "ready", guardian: "ready", executor: "ready" })
        if (evt.data.session_pnl != null) setSessionPnl(evt.data.session_pnl as number)
        if (evt.data.veto_count != null) setVetoCount(evt.data.veto_count as number)
        if (evt.data.approval_count != null) setApprovalCount(evt.data.approval_count as number)
      }
    } catch {
      // ignore parse errors
    }
  }, [])

  const handleRunCycle = useCallback(async () => {
    if (running) return
    setRunning(true)
    setDecision(null)
    setTxHash(undefined)
    try {
      await triggerCycle()
      if (esRef.current) esRef.current.close()
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const es = new EventSource(`${API_BASE}/stream`)
      esRef.current = es
      es.onmessage = handleSSEMessage
      es.onerror = () => {
        setRunning(false)
        es.close()
        setAgentStatuses({ scout: "ready", strategist: "ready", guardian: "ready", executor: "ready" })
        setActiveNode(null)
      }
    } catch {
      setRunning(false)
    }
  }, [running, handleSSEMessage])

  useEffect(() => {
    return () => {
      if (esRef.current) esRef.current.close()
    }
  }, [])

  const fmtPnl = (v: number) => {
    const sign = v >= 0 ? "+" : ""
    return `${sign}$${v.toFixed(2)}`
  }

  return (
    <div style={{ minHeight: "100vh", position: "relative", zIndex: 1 }}>
      {/* Top Bar */}
      <header
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          borderBottom: "1px solid var(--border-default)",
          background: "var(--bg-deep)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 4,
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            }}
          />
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 16 }}>⚡ APEX</span>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--text-muted)", fontWeight: 300 }}>
            SELF-CERTIFYING YIELD OPTIMIZER
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-ghost)" }}>ERC-8004 · Base Sepolia</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-ghost)" }}>LangGraph</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-ghost)" }}>Groq LPU</span>
          <button
            onClick={handleRunCycle}
            disabled={running || !backendOk}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
              padding: "8px 20px",
              borderRadius: 4,
              border: "none",
              background: running || !backendOk
                ? "var(--bg-overlay)"
                : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              color: running || !backendOk ? "var(--text-muted)" : "#fff",
              cursor: running || !backendOk ? "not-allowed" : "pointer",
              opacity: running || !backendOk ? 0.4 : 1,
              transition: "all 0.2s ease",
            }}
          >
            ▶ RUN CYCLE
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr 300px",
          gap: 0,
          minHeight: "calc(100vh - 64px)",
        }}
      >
        {/* Left Panel */}
        <aside
          style={{
            padding: 20,
            borderRight: "1px solid var(--border-default)",
            background: "var(--bg-deep)",
          }}
        >
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 16, letterSpacing: 1 }}>
            Agents
          </div>
          {(agents.length > 0
            ? agents
            : [
                { name: "scout" as AgentName, agent_id: 0, role: "" },
                { name: "strategist" as AgentName, agent_id: 0, role: "" },
                { name: "guardian" as AgentName, agent_id: 0, role: "" },
                { name: "executor" as AgentName, agent_id: 0, role: "" },
              ]
          ).map((agent) => (
            <AgentCard
              key={agent.name}
              name={agent.name}
              status={agentStatuses[agent.name]}
              repScore={repScores[agent.name]}
              agentId={agent.agent_id}
            />
          ))}

          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              marginBottom: 12,
              marginTop: 24,
              letterSpacing: 1,
            }}
          >
            Session
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <StatTile label="Vetoes" value={String(vetoCount)} color="var(--vetoed)" />
            <StatTile label="Approved" value={String(approvalCount)} color="var(--approved)" />
            <StatTile label="Session PnL" value={fmtPnl(sessionPnl)} color={sessionPnl >= 0 ? "var(--approved)" : "var(--vetoed)"} />
            <StatTile label="Vol Index" value={volatilityIndex.toFixed(1)} color="var(--guardian)" />
          </div>

          {!backendOk && (
            <div
              style={{
                marginTop: 20,
                padding: 12,
                background: "#f8717110",
                border: "1px solid #f8717140",
                borderRadius: 4,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--vetoed)",
              }}
            >
              Backend not connected
            </div>
          )}
        </aside>

        {/* Centre Panel */}
        <main style={{ padding: "28px 48px", overflowY: "auto" }}>
          <FlowDiagram activeNode={activeNode} />

          <DecisionBanner decision={decision} txHash={txHash} />

          <div style={{ marginTop: 12 }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 12,
              }}
            >
              Veto Log
            </div>
            {vetoRows.length === 0 ? (
              <div
                style={{
                  padding: 20,
                  textAlign: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--text-muted)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 4,
                }}
              >
                No vetoes yet — run a cycle to begin
              </div>
            ) : (
              <div style={{ border: "1px solid var(--border-default)", borderRadius: 4, overflow: "hidden" }}>
                {vetoRows.map((row, i) => (
                  <VetoRow key={i} {...row} index={i} />
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Right Panel */}
        <aside
          style={{
            padding: 20,
            borderLeft: "1px solid var(--border-default)",
            background: "var(--bg-deep)",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 16,
            }}
          >
            Live Event Feed
          </div>
          {feedItems.length === 0 ? (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--text-muted)",
                textAlign: "center",
                padding: 40,
              }}
            >
              Waiting for events...
            </div>
          ) : (
            feedItems.map((item, i) => <EventFeedItemComponent key={`${item.timestamp}-${i}`} item={item} />)
          )}
        </aside>
      </div>
    </div>
  )
}
