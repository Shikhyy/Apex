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
}: AgentCardProps) {
  return (
    <div
      style={{
        padding: 24,
        background: "var(--deep)",
        border: "1px solid var(--dim)",
        borderLeft: `3px solid ${color}`,
        boxShadow: isActive ? `0 0 20px ${color}33` : "none",
        transition: "all var(--base) var(--ease-out)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 24,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "999px",
              background: isActive ? color : "var(--dim)",
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
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1, color: color, marginBottom: 12 }}>
          {role}
        </div>
        {agentId !== undefined && (
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
        )}
        {lastDecision && (
          <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--mid)" }}>
            Last: {lastDecision}
          </div>
        )}
      </div>

      <RepScoreRing score={repScore} color={color} />
    </div>
  );
}
