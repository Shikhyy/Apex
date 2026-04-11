"use client";

import type { SSEEvent } from "@/lib/types";

interface AgentConversationPanelProps {
  events: SSEEvent[];
}

interface AgentMessage {
  agent: string;
  timestamp: string;
  title: string;
  bullets: string[];
  color: string;
  icon: string;
  isVeto?: boolean;
  isApproved?: boolean;
  isTrade?: boolean;
}

const agentMeta: Record<string, { label: string; color: string; icon: string }> = {
  scout:      { label: "SCOUT",      color: "#60a5fa", icon: "◎" },
  strategist: { label: "STRATEGIST", color: "#c084fc", icon: "◈" },
  guardian:   { label: "GUARDIAN",   color: "#fbbf24", icon: "⬡" },
  executor:   { label: "EXECUTOR",   color: "#34d399", icon: "◆" },
  veto:       { label: "VETO",       color: "#f87171", icon: "⊘" },
  done:       { label: "DONE",       color: "#6b7280", icon: "✓" },
};

function parseEventToMessage(event: SSEEvent): AgentMessage | null {
  const { type, data, timestamp } = event;
  const meta = agentMeta[type];
  if (!meta) return null;

  const time = new Date(timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  switch (type) {
    case "scout": {
      const opps = (data.opportunities as unknown[]) || [];
      const vol = Number(data.volatility_index || 0);
      const senti = Number(data.sentiment_score || 0);
      const reasoning = (data.scout_reasoning as string) || "";
      return {
        agent: type,
        timestamp: time,
        title: `Scanned market — ${opps.length} opportunities found`,
        bullets: [
          `Volatility Index: ${vol.toFixed(1)}/100`,
          `Market Sentiment: ${senti >= 0 ? "+" : ""}${senti.toFixed(2)} (${senti > 0.2 ? "bullish" : senti < -0.2 ? "bearish" : "neutral"})`,
          ...(reasoning ? [reasoning.slice(0, 180)] : []),
        ].filter(Boolean),
        color: meta.color,
        icon: meta.icon,
      };
    }

    case "strategist": {
      const intents = (data.ranked_intents as unknown[]) || [];
      const reasoning = (data.strategist_reasoning as string) || "";
      // Parse top intent details
      const topIntent = intents[0] as Record<string, unknown> | undefined;
      const bullets: string[] = [`Generated ${intents.length} ranked trade intent${intents.length !== 1 ? "s" : ""}`];
      if (topIntent) {
        const opp = topIntent.opportunity as Record<string, unknown>;
        bullets.push(
          `Top: ${opp?.protocol || "?"}/${opp?.pool || "?"} — ${Number(opp?.apy || 0).toFixed(2)}% APY`
        );
        bullets.push(`Position: $${Number(topIntent.amount_usd || 0).toLocaleString()} | Confidence: ${(Number(topIntent.confidence || 0) * 100).toFixed(0)}%`);
      }
      if (reasoning && reasoning.length > 0) {
        const short = reasoning.slice(0, 160);
        bullets.push(short);
      }
      return {
        agent: type,
        timestamp: time,
        title: "Trade intents ranked by risk-adjusted return",
        bullets,
        color: meta.color,
        icon: meta.icon,
      };
    }

    case "guardian": {
      const decision = String(data.guardian_decision || "").toUpperCase();
      const reason = data.guardian_reason as string;
      const detail = data.guardian_detail as string;
      const confidence = Number(data.guardian_confidence || 0);
      const isApproved = decision === "APPROVED";
      const isVeto = decision === "VETOED";
      return {
        agent: type,
        timestamp: time,
        title: isApproved
          ? "Risk check PASSED — Trade approved"
          : `Risk check FAILED — Trade vetoed`,
        bullets: [
          `Confidence: ${(confidence * 100).toFixed(0)}%`,
          reason ? `Reason: ${reason.replace(/_/g, " ")}` : "",
          detail || "",
        ].filter(Boolean),
        color: isApproved ? "#34d399" : "#f87171",
        icon: isApproved ? "✓" : "⊘",
        isVeto: isVeto,
        isApproved: isApproved,
      };
    }

    case "executor": {
      const txHash = data.tx_hash as string;
      const pnl = Number(data.actual_pnl || 0);
      const protocol = data.executed_protocol as string;
      const err = data.execution_error as string;
      const executionMode = String(data.execution_mode || "simulation").toLowerCase();
      const hasTx = txHash && txHash.length > 4;
      const hasErr = err && err.length > 2 && err !== "No ranked intents available.";

      if (hasErr) {
        return {
          agent: type,
          timestamp: time,
          title: "Execution encountered an error",
          bullets: [err.slice(0, 160)],
          color: "#f87171",
          icon: "⚠",
        };
      }

      return {
        agent: type,
        timestamp: time,
        title:
          executionMode === "live"
            ? `Trade executed live — ${protocol || "venue"}`
            : executionMode === "failed"
            ? "Execution failed"
            : "Trade executed (simulated)",
        bullets: [
          `Mode: ${executionMode}`,
          `Realized PnL: $${pnl.toFixed(2)}`,
          hasTx
            ? `TX Hash: ${txHash.slice(0, 14)}...${txHash.slice(-6)}`
            : "Using simulation (no RiskRouter configured)",
        ].filter(Boolean),
        color: meta.color,
        icon: meta.icon,
        isTrade: true,
      };
    }

    case "veto": {
      return {
        agent: type,
        timestamp: time,
        title: "Trade rejected — Capital protected",
        bullets: ["Guardian circuit breaker engaged", "No funds deployed this cycle"],
        color: meta.color,
        icon: meta.icon,
        isVeto: true,
      };
    }

    case "done": {
      const sessionPnl = Number(data.session_pnl || 0);
      const cycle = Number(data.cycle_number || 0);
      const vetoes = Number(data.veto_count || 0);
      const approvals = Number(data.approval_count || 0);
      return {
        agent: type,
        timestamp: time,
        title: `Cycle #${cycle} complete`,
        bullets: [
          `Session PnL: $${sessionPnl.toFixed(2)}`,
          `Approved: ${approvals} | Vetoed: ${vetoes}`,
        ],
        color: meta.color,
        icon: meta.icon,
      };
    }

    default:
      return null;
  }
}

export default function AgentConversationPanel({ events }: AgentConversationPanelProps) {
  const messages = events
    .map(parseEventToMessage)
    .filter((m): m is AgentMessage => m !== null);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        height: "100%",
        overflowY: "auto",
        padding: "0 0 8px",
      }}
    >
      {messages.length === 0 && (
        <div
          style={{
            padding: "32px 20px",
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "#333",
            letterSpacing: 1,
          }}
        >
          Agent conversations will appear here
        </div>
      )}

      {messages.map((msg, i) => {
        const isLatest = i === messages.length - 1;
        return (
          <div
            key={i}
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid #111",
              background: isLatest ? `${msg.color}08` : "transparent",
              animation: isLatest ? "fadeIn 400ms var(--ease-out)" : "none",
              transition: "background 400ms",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 14, color: msg.color }}>{msg.icon}</span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: 2,
                  color: msg.color,
                  fontWeight: 700,
                }}
              >
                {(agentMeta[msg.agent] || { label: msg.agent.toUpperCase() }).label}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  color: "#333",
                  marginLeft: "auto",
                }}
              >
                {msg.timestamp}
              </span>
            </div>

            {/* Title */}
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "#aaa",
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              {msg.title}
            </div>

            {/* Bullets */}
            {msg.bullets.map((bullet, j) => (
              <div
                key={j}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "#555",
                  display: "flex",
                  gap: 6,
                  alignItems: "flex-start",
                  marginBottom: 2,
                }}
              >
                <span style={{ color: "#333", flexShrink: 0 }}>›</span>
                <span>{bullet}</span>
              </div>
            ))}

            {/* Status badge for key events */}
            {(msg.isVeto || msg.isApproved || msg.isTrade) && (
              <div
                style={{
                  marginTop: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 10px",
                  background: `${msg.color}15`,
                  border: `1px solid ${msg.color}44`,
                  fontFamily: "var(--font-mono)",
                  fontSize: 8,
                  letterSpacing: 2,
                  color: msg.color,
                }}
              >
                {msg.isVeto ? "VETOED" : msg.isApproved ? "APPROVED" : "EXECUTED"}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
