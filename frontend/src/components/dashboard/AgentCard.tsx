"use client";

import Link from "next/link";
import RepScoreRing from "./RepScoreRing";
import type { AgentName } from "@/lib/types";

interface AgentCardProps {
  name: AgentName;
  role: string;
  color: string;
  repScore: number;
  agentId?: number;
  lastDecision?: string;
  isActive?: boolean;
  headline?: string;
  statusLabel?: string;
  detail?: string;
  eventCount?: number;
}

const agentLabels: Record<AgentName, string> = {
  scout: "SCOUT",
  strategist: "STRATEGIST",
  guardian: "GUARDIAN",
  executor: "EXECUTOR",
};

export default function AgentCard({
  name,
  role,
  color,
  repScore,
  agentId,
  lastDecision,
  isActive,
  headline,
  statusLabel,
  detail,
  eventCount,
}: AgentCardProps) {
  const badgeLabel = statusLabel || (isActive ? "LIVE" : "STANDBY");
  const badgeTone = isActive ? color : "var(--muted)";

  return (
    <div
      style={{
        position: "relative",
        padding: 24,
        background: "linear-gradient(160deg, rgba(17,17,17,0.96), rgba(10,10,10,0.98))",
        border: "1px solid var(--dim)",
        borderLeft: `3px solid ${color}`,
        boxShadow: isActive ? `0 0 28px ${color}26, inset 0 0 18px ${color}0f` : "none",
        transition: "all var(--base) var(--ease-out)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 24,
        overflow: "hidden",
        minHeight: 220,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(500px 160px at 0% 0%, ${color}14, transparent 60%), linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.02) 50%, transparent 100%)`,
          pointerEvents: "none",
          opacity: isActive ? 1 : 0.7,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
          backgroundSize: "100% 18px, 18px 100%",
          opacity: 0.18,
          pointerEvents: "none",
          maskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
        }}
      />

      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "999px",
              background: isActive ? color : "var(--dim)",
              boxShadow: isActive ? `0 0 10px ${color}` : "none",
              animation: isActive ? "pulse 1.5s infinite" : "none",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 24,
              letterSpacing: 3,
              color: "var(--white)",
            }}
          >
            {agentLabels[name]}
          </span>
          <span
            style={{
              padding: "3px 8px",
              border: `1px solid ${badgeTone}`,
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: 1,
              color: badgeTone,
              textTransform: "uppercase",
            }}
          >
            {badgeLabel}
          </span>
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1, color: color, marginBottom: 12 }}>
          {role}
        </div>
        <div
          style={{
            marginBottom: 14,
            maxWidth: 340,
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--muted)",
          }}
        >
          <div style={{ color: "var(--white)", marginBottom: 4, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1 }}>
            {headline || "No active signal"}
          </div>
          {detail || "Live pipeline node. Waiting for the next authenticated signal from the cycle stream."}
        </div>
        {agentId !== undefined && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <Link
              href={`https://sepolia.basescan.org/token/${agentId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--muted)",
                textDecoration: "underline",
                textDecorationColor: "transparent",
                transition: "text-decoration-color var(--fast)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecorationColor = "var(--amber)")}
              onMouseLeave={(e) => (e.currentTarget.style.textDecorationColor = "transparent")}
            >
              ERC-8004 #{agentId}
            </Link>
            {typeof eventCount === "number" && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--mid)" }}>
                {eventCount} events tracked
              </span>
            )}
          </div>
        )}
        {lastDecision && (
          <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--mid)" }}>
            Last: {lastDecision}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <RepScoreRing score={repScore} color={color} label="Reputation" />
        <div
          style={{
            width: 116,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          <div
            style={{
              padding: "8px 10px",
              border: `1px solid ${color}33`,
              background: "rgba(255,255,255,0.02)",
              textAlign: "center",
            }}
          >
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--mid)", letterSpacing: 1 }}>
              STATE
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: color, marginTop: 4 }}>
              {isActive ? "ACTIVE" : "IDLE"}
            </div>
          </div>
          <div
            style={{
              padding: "8px 10px",
              border: `1px solid ${color}33`,
              background: "rgba(255,255,255,0.02)",
              textAlign: "center",
            }}
          >
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--mid)", letterSpacing: 1 }}>
              FLOW
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--white)", marginTop: 4 }}>
              LIVE
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
