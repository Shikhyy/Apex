"use client";

import { useState } from "react";
import Topbar from "@/components/dashboard/Topbar";
import RepScoreRing from "@/components/dashboard/RepScoreRing";
import { useReputation } from "@/hooks/useReputation";
import { getAgentWallet, getClients, readFeedback as readOnChainFeedback } from "@/lib/contracts";
import type { AgentName, FeedbackEntry } from "@/lib/types";
import { useEffect } from "react";

const agents: { name: AgentName; role: string; color: string; agentId: number; model: string }[] = [
  { name: "scout", role: "Market Intelligence", color: "var(--blue)", agentId: 1, model: "Groq LLM" },
  { name: "strategist", role: "Portfolio Optimization", color: "var(--purple)", agentId: 2, model: "Groq LLM" },
  { name: "guardian", role: "Risk Enforcement", color: "var(--gold)", agentId: 3, model: "Groq LLM" },
  { name: "executor", role: "Trade Execution", color: "var(--green)", agentId: 4, model: "On-chain" },
];

export default function AgentsPage() {
  const [connected] = useState(true);

  return (
    <>
      <Topbar title="Agent Registry" connected={connected} />
      <main style={{ padding: 32, display: "flex", flexDirection: "column", gap: 32 }}>
        {agents.map((agent) => (
          <AgentDetailCard key={agent.name} agent={agent} />
        ))}
      </main>
    </>
  );
}

function AgentDetailCard({
  agent,
}: {
  agent: { name: AgentName; role: string; color: string; agentId: number; model: string };
}) {
  const rep = useReputation(BigInt(agent.agentId));
  const [wallet, setWallet] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackEntry[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    getAgentWallet(BigInt(agent.agentId))
      .then((w) => setWallet(w))
      .catch(() => setWallet(null));
  }, [agent.agentId]);

  useEffect(() => {
    if (rep.summary && rep.summary.count > 0) {
      getClients(BigInt(agent.agentId))
        .then((clients) => {
          const entries: FeedbackEntry[] = [];
          const promises = clients.slice(0, 5).map(async (client) => {
            try {
              const result = await readOnChainFeedback(BigInt(agent.agentId), client, BigInt(0));
              entries.push({
                value: result[0],
                valueDecimals: result[1],
                tag1: result[2],
                tag2: result[3],
                isRevoked: result[4],
              });
            } catch {
              // Skip failed reads
            }
          });
          Promise.all(promises).then(() => setFeedbacks(entries));
        })
        .catch(() => {});
    }
  }, [rep.summary, agent.agentId]);

  return (
    <div
      style={{
        background: "var(--deep)",
        border: "1px solid var(--dim)",
        borderLeft: `3px solid ${agent.color}`,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 24,
          borderBottom: "1px solid var(--dim)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 32,
                letterSpacing: 3,
                color: "var(--white)",
              }}
            >
              {agent.name.toUpperCase()}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: 2,
                color: agent.color,
                padding: "2px 8px",
                border: `1px solid ${agent.color}`,
              }}
            >
              {agent.role}
            </span>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
            Model: {agent.model} · Agent ID: #{agent.agentId}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <a
            href={`https://sepolia.basescan.org/token/${agent.agentId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--amber)",
              textDecoration: "underline",
            }}
          >
            ERC-8004 ↗
          </a>
          {wallet && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>
              {wallet.slice(0, 6)}...{wallet.slice(-4)}
            </span>
          )}
          <RepScoreRing score={rep.summary?.normalized ?? 0} size={80} color={agent.color} />
        </div>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          borderBottom: "1px solid var(--dim)",
        }}
      >
        {[
          { label: "Reputation", value: `${rep.summary?.normalized ?? 0}%` },
          { label: "Feedbacks", value: String(rep.summary?.count ?? 0) },
          { label: "Model", value: agent.model },
          { label: "Status", value: rep.loading ? "Loading..." : rep.error ? "Error" : "Active" },
        ].map((s) => (
          <div key={s.label} style={{ padding: 16, borderRight: "1px solid var(--dim)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: 2, color: "var(--mid)", marginBottom: 4, textTransform: "uppercase" }}>
              {s.label}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, color: "var(--white)" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Feedback entries */}
      <div style={{ padding: 24 }}>
        <button
          onClick={() => setExpanded(!expanded)}
          data-interactive
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: 2,
            color: "var(--amber)",
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          {expanded ? "Hide" : "Show"} Feedback Entries ({feedbacks.length})
        </button>

        {expanded && feedbacks.length > 0 && (
          <table style={{ width: "100%", fontFamily: "var(--font-mono)", fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--dim)" }}>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--mid)" }}>Value</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--mid)" }}>Tag 1</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--mid)" }}>Tag 2</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--mid)" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {feedbacks.map((f, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--dim)" }}>
                  <td style={{ padding: "8px 12px", color: Number(f.value) >= 0 ? "var(--green)" : "var(--red)" }}>
                    {Number(f.value) / 10 ** f.valueDecimals}
                  </td>
                  <td style={{ padding: "8px 12px", color: "var(--white)" }}>{f.tag1 || "—"}</td>
                  <td style={{ padding: "8px 12px", color: "var(--white)" }}>{f.tag2 || "—"}</td>
                  <td style={{ padding: "8px 12px", color: f.isRevoked ? "var(--red)" : "var(--green)" }}>
                    {f.isRevoked ? "Revoked" : "Active"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {expanded && feedbacks.length === 0 && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--mid)", padding: 16 }}>
            No feedback entries found on-chain.
          </div>
        )}
      </div>
    </div>
  );
}
