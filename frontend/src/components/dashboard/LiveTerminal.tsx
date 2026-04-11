"use client";

import { useEffect, useRef } from "react";
import type { SSEEvent } from "@/lib/types";

interface LiveTerminalProps {
  events: SSEEvent[];
}

const agentConfig: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  scout: { label: "SCOUT", color: "#60a5fa", icon: "◎" },
  strategist: { label: "STRATEGIST", color: "#c084fc", icon: "◈" },
  guardian: { label: "GUARDIAN", color: "#fbbf24", icon: "⬡" },
  executor: { label: "EXECUTOR", color: "#34d399", icon: "◆" },
  veto: { label: "VETO", color: "#f87171", icon: "⊘" },
  done: { label: "DONE", color: "#6b7280", icon: "✓" },
};

function formatEventMessage(event: SSEEvent): string[] {
  const { type, data } = event;
  const lines: string[] = [];

  switch (type) {
    case "scout": {
      const opps = data.opportunities as unknown[];
      const vol = data.volatility_index;
      const senti = data.sentiment_score;
      const reasoning = data.scout_reasoning as string;
      if (vol !== undefined) lines.push(`Market volatility: ${Number(vol).toFixed(1)} | Sentiment: ${Number(senti).toFixed(2)}`);
      if (opps) lines.push(`Found ${opps.length} yield opportunities`);
      if (reasoning) lines.push(reasoning.slice(0, 200));
      break;
    }
    case "strategist": {
      const intents = data.ranked_intents as unknown[];
      const reasoning = data.strategist_reasoning as string;
      if (intents) lines.push(`Generated ${intents.length} trade intents`);
      if (reasoning) lines.push(reasoning.slice(0, 200));
      break;
    }
    case "guardian": {
      const decision = data.guardian_decision as string;
      const reason = data.guardian_reason as string;
      const detail = data.guardian_detail as string;
      const confidence = data.guardian_confidence as number;
      if (decision) lines.push(`Decision: ${decision} (${Math.round(confidence * 100)}% confidence)`);
      if (reason) lines.push(`Reason: ${reason}`);
      if (detail) lines.push(detail);
      break;
    }
    case "executor": {
      const txHash = data.tx_hash as string;
      const pnl = data.actual_pnl as number;
      const protocol = data.executed_protocol as string;
      const err = data.execution_error as string;
      if (err && err.length > 2) {
        lines.push(`Error: ${err.slice(0, 100)}`);
      } else {
        if (protocol) lines.push(`Executed: ${protocol}`);
        if (pnl !== undefined) lines.push(`PnL: $${Number(pnl).toFixed(2)}`);
        if (txHash) lines.push(`TX: ${txHash.slice(0, 18)}...${txHash.slice(-6)}`);
      }
      break;
    }
    case "veto": {
      lines.push("Trade vetoed — capital protected");
      break;
    }
    case "done": {
      const pnl = data.session_pnl as number;
      const cycle = data.cycle_number as number;
      const vetoes = data.veto_count as number;
      const approvals = data.approval_count as number;
      lines.push(`Cycle #${cycle} complete`);
      lines.push(`Session PnL: $${Number(pnl).toFixed(2)} | Vetoes: ${vetoes} | Approvals: ${approvals}`);
      break;
    }
    default:
      lines.push(JSON.stringify(data).slice(0, 120));
  }

  return lines.filter(Boolean);
}

export default function LiveTerminal({ events }: LiveTerminalProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div
      style={{
        background: "#080808",
        border: "1px solid #1e1e1e",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 400,
      }}
    >
      {/* Terminal header */}
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid #1e1e1e",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "#0d0d0d",
          flexShrink: 0,
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: "999px", background: "#ff5f57", display: "inline-block" }} />
        <span style={{ width: 10, height: 10, borderRadius: "999px", background: "#febc2e", display: "inline-block" }} />
        <span style={{ width: 10, height: 10, borderRadius: "999px", background: "#28c840", display: "inline-block" }} />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "#555",
            marginLeft: 12,
            letterSpacing: 2,
          }}
        >
          APEX AGENT STREAM
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "#333",
          }}
        >
          {events.length} events
        </span>
      </div>

      {/* Events body */}
      <div
        ref={bodyRef}
        style={{
          padding: "12px 16px",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          lineHeight: 1.8,
          overflowY: "auto",
          flex: 1,
        }}
      >
        {events.length === 0 ? (
          <div style={{ color: "#333", paddingTop: 8 }}>
            <span style={{ color: "#555" }}>$</span>{" "}
            <span style={{ color: "#444" }}>Waiting for agent events</span>
            <span
              style={{
                display: "inline-block",
                width: 7,
                height: 14,
                background: "#444",
                marginLeft: 4,
                animation: "pulse 1s infinite",
                verticalAlign: "middle",
              }}
            />
          </div>
        ) : (
          events.map((event, i) => {
            const cfg = agentConfig[event.type] || { label: event.type.toUpperCase(), color: "#ccc", icon: "•" };
            const lines = formatEventMessage(event);
            const time = new Date(event.timestamp).toLocaleTimeString("en-US", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });

            return (
              <div
                key={i}
                style={{
                  marginBottom: 10,
                  animation: i === events.length - 1 ? "terminalLine 300ms var(--ease-out) both" : "none",
                  borderLeft: `2px solid ${cfg.color}33`,
                  paddingLeft: 10,
                }}
              >
                {/* Header row */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ color: "#333", fontSize: 10 }}>[{time}]</span>
                  <span style={{ color: cfg.color, fontWeight: 700 }}>
                    {cfg.icon} {cfg.label}
                  </span>
                </div>
                {/* Detail lines */}
                {lines.map((line, j) => (
                  <div
                    key={j}
                    style={{
                      color: j === 0 ? "#aaa" : "#666",
                      fontSize: j === 0 ? 12 : 11,
                      paddingLeft: 4,
                    }}
                  >
                    {line}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
