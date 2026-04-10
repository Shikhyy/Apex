"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import Topbar from "@/components/dashboard/Topbar";
import RepScoreRing from "@/components/dashboard/RepScoreRing";
import { useReputation } from "@/hooks/useReputation";
import { getAgentWallet, getClients, readFeedback as readOnChainFeedback, ADDRESSES, REPUTATION_REGISTRY_ABI } from "@/lib/contracts";
import type { AgentName, FeedbackEntry } from "@/lib/types";
import { keccak256, toHex } from "viem";

const agents: { name: AgentName; role: string; color: string; agentId: number; model: string }[] = [
  { name: "scout", role: "Market Intelligence", color: "var(--apex-cream)", agentId: 1, model: "Groq LLM" },
  { name: "strategist", role: "Portfolio Optimization", color: "var(--apex-burn)", agentId: 2, model: "Groq LLM" },
  { name: "guardian", role: "Risk Enforcement", color: "var(--apex-dark-red)", agentId: 3, model: "Groq LLM" },
  { name: "executor", role: "Trade Execution", color: "var(--apex-burn)", agentId: 4, model: "On-chain" },
];

export default function AgentsPage() {
  const { isConnected } = useAccount();

  return (
    <>
      <Topbar title="Agent Registry" connected={isConnected} />
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
  const { isConnected } = useAccount();
  const rep = useReputation(BigInt(agent.agentId));
  const [wallet, setWallet] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

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
    <>
      <div style={{ background: "var(--deep)", border: "1px solid var(--dim)", borderLeft: `3px solid ${agent.color}`, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 24, borderBottom: "1px solid var(--dim)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 32, letterSpacing: 3, color: "var(--white)" }}>
                {agent.name.toUpperCase()}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: 2, color: agent.color, padding: "2px 8px", border: `1px solid ${agent.color}` }}>
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
              style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--apex-burn)", textDecoration: "underline" }}
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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderBottom: "1px solid var(--dim)" }}>
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

        <div style={{ padding: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={() => setExpanded(!expanded)}
            data-interactive
            style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--apex-burn)", textTransform: "uppercase" }}
          >
            {expanded ? "Hide" : "Show"} Feedback Entries ({feedbacks.length})
          </button>

          {isConnected && (
            <button
              onClick={() => setShowFeedbackModal(true)}
              data-interactive
              style={{
                padding: "8px 16px",
                border: `1px solid ${agent.color}`,
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: 1,
                color: agent.color,
              }}
            >
              Give Feedback
            </button>
          )}
        </div>

        {expanded && feedbacks.length > 0 && (
          <div style={{ padding: "0 24px 24px" }}>
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
          </div>
        )}

        {expanded && feedbacks.length === 0 && (
          <div style={{ padding: "16px 24px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--mid)" }}>
            No feedback entries found on-chain.
          </div>
        )}

        {/* Reputation Over Time Chart */}
        <div style={{ padding: "0 24px 24px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--mid)", marginBottom: 12, textTransform: "uppercase" }}>
            Reputation Trend
          </div>
          <RepChart score={rep.summary?.normalized ?? 0} color={agent.color} />
        </div>
      </div>

      {showFeedbackModal && (
        <FeedbackModal
          agentId={agent.agentId}
          agentName={agent.name}
          color={agent.color}
          onClose={() => setShowFeedbackModal(false)}
        />
      )}
    </>
  );
}

function RepChart({ score, color }: { score: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 80 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--mid)" }}>
        Current score: <span style={{ color, fontWeight: 700, fontSize: 18 }}>{score}%</span>
      </div>
    </div>
  );
}

function FeedbackModal({
  agentId,
  agentName,
  color,
  onClose,
}: {
  agentId: number;
  agentName: string;
  color: string;
  onClose: () => void;
}) {
  const [value, setValue] = useState(0);
  const [tag1, setTag1] = useState("");
  const [tag2, setTag2] = useState("");
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handleSubmit = () => {
    const feedbackHash = keccak256(toHex(`apex-feedback-${agentId}-${Date.now()}`));
    writeContract({
      address: ADDRESSES.reputationRegistry,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: "giveFeedback",
      args: [BigInt(agentId), BigInt(value), 2, tag1 || "general", tag2 || "", "", "", feedbackHash],
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--deep)",
          border: `1px solid ${color}`,
          padding: 32,
          maxWidth: 400,
          width: "100%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 24, letterSpacing: 3, color: "var(--white)", marginBottom: 24 }}>
          FEEDBACK FOR {agentName.toUpperCase()}
        </h3>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--mid)", display: "block", marginBottom: 8 }}>
            Value (-100 to 100)
          </label>
          <input
            type="range"
            min={-100}
            max={100}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            style={{ width: "100%", accentColor: color }}
          />
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: value >= 0 ? "var(--green)" : "var(--red)", textAlign: "center", marginTop: 4 }}>
            {value >= 0 ? "+" : ""}{value}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--mid)", display: "block", marginBottom: 8 }}>Tag 1</label>
          <input
            type="text"
            value={tag1}
            onChange={(e) => setTag1(e.target.value)}
            placeholder="e.g. accuracy, timeliness"
            style={{ width: "100%", padding: "8px 12px", background: "var(--raised)", border: "1px solid var(--dim)", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--white)", outline: "none" }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--mid)", display: "block", marginBottom: 8 }}>Tag 2</label>
          <input
            type="text"
            value={tag2}
            onChange={(e) => setTag2(e.target.value)}
            placeholder="e.g. risk-aware, thorough"
            style={{ width: "100%", padding: "8px 12px", background: "var(--raised)", border: "1px solid var(--dim)", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--white)", outline: "none" }}
          />
        </div>

        {isConfirmed && (
          <div style={{ padding: 12, background: "#34d39915", border: "1px solid var(--green)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--green)", marginBottom: 16 }}>
            ✓ Feedback submitted on-chain
          </div>
        )}

        {error && (
          <div style={{ padding: 12, background: "#f8717115", border: "1px solid var(--red)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--red)", marginBottom: 16 }}>
            {error.message}
          </div>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={handleSubmit}
            disabled={isPending || isConfirming}
            data-interactive
            style={{
              flex: 1,
              padding: "12px",
              background: isPending || isConfirming ? "var(--mid)" : color,
              color: "var(--void)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              fontWeight: 700,
              cursor: isPending || isConfirming ? "not-allowed" : "pointer",
            }}
          >
            {isPending ? "Signing..." : isConfirming ? "Confirming..." : "Submit On-Chain"}
          </button>
          <button
            onClick={onClose}
            style={{ padding: "12px 20px", border: "1px solid var(--dim)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
