"use client";

import { useEffect, useRef } from "react";
import type { SSEEvent } from "@/lib/types";

interface LiveTerminalProps {
  events: SSEEvent[];
}

const colorMap: Record<string, string> = {
  scout: "var(--blue)",
  strategist: "var(--purple)",
  guardian: "var(--gold)",
  executor: "var(--green)",
  veto: "var(--red)",
  done: "var(--muted)",
};

export default function LiveTerminal({ events }: LiveTerminalProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div style={{ background: "#0d0d0d", border: "1px solid var(--dim)", overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--dim)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: "999px", background: "#ff5f57" }} />
        <span style={{ width: 10, height: 10, borderRadius: "999px", background: "#febc2e" }} />
        <span style={{ width: 10, height: 10, borderRadius: "999px", background: "#28c840" }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--mid)", marginLeft: 8 }}>
          APEX EVENT STREAM — {events.length} events
        </span>
      </div>
      <div
        ref={bodyRef}
        style={{ padding: 16, fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.9, maxHeight: 400, overflowY: "auto" }}
      >
        {events.length === 0 && (
          <div style={{ color: "var(--mid)" }}>Waiting for events...</div>
        )}
        {events.map((event, i) => {
          const color = colorMap[event.type] || "var(--white)";
          return (
            <div
              key={i}
              style={{
                color,
                animation: "terminalLine 300ms var(--ease-out) both",
              }}
            >
              <span style={{ color: "var(--dim)" }}>
                [{new Date(event.timestamp).toLocaleTimeString("en-US", { hour12: false })}]
              </span>{" "}
              [{event.type.toUpperCase()}]{" "}
              <span style={{ color: "var(--muted)" }}>
                {JSON.stringify(event.data).slice(0, 120)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
