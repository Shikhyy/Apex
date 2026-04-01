"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { staggerContainer, fadeSlideUp } from "@/lib/animations"
import { fetchAgents, fetchReputation } from "@/lib/api"
import type { AgentInfo, AgentName, ReputationResponse } from "@/lib/types"
import { Sidebar } from "@/components/layout/sidebar"
import { ProgressBar } from "@/components/ui/progress-bar"

const AGENT_COLORS: Record<AgentName, string> = {
  scout: "#888888",
  strategist: "#666666",
  guardian: "#a0a0a0",
  executor: "#555555",
}

export default function ReputationPage() {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [reputations, setReputations] = useState<Record<string, ReputationResponse | null>>({})
  const [loading, setLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)

  useEffect(() => {
    fetchAgents()
      .then((data) => {
        setAgents(data.agents)
        data.agents.forEach((agent: AgentInfo) => {
          fetchReputation(agent.agent_id)
            .then((rep) => {
              setReputations((prev) => ({ ...prev, [agent.name]: rep }))
            })
            .catch(() => {
              setReputations((prev) => ({ ...prev, [agent.name]: null }))
            })
        })
      })
      .finally(() => setLoading(false))
  }, [])

  const selectedRep = selectedAgent ? reputations[selectedAgent] : null

  const totalAttestations = Object.values(reputations).reduce(
    (sum, rep) => sum + (rep?.count ?? 0),
    0
  )

  const avgScore = Object.values(reputations).reduce((sum, rep) => {
    if (!rep) return sum
    return sum + rep.normalized
  }, 0) / (Object.values(reputations).filter(Boolean).length || 1)

  return (
    <div className="app-layout">
      <Sidebar />

      <motion.main
        className="main-content"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <div className="page-header">
          <h1 className="page-title">Reputation</h1>
          <p className="page-subtitle">On-chain ERC-8004 reputation scores and attestations</p>
        </div>

        <motion.div variants={fadeSlideUp} className="stats-grid">
          <div className="stat-card">
            <div className="stat-value" style={{ color: "var(--copper-light)" }}>{totalAttestations}</div>
            <div className="stat-label">Total Attestations</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: "var(--copper)" }}>{Math.round(avgScore * 100)}%</div>
            <div className="stat-label">Average Score</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{agents.length}</div>
            <div className="stat-label">Registered Agents</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">Base Sepolia</div>
            <div className="stat-label">Network</div>
          </div>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "var(--space-xl)" }}>
          <div>
            <motion.div variants={fadeSlideUp} className="card-label" style={{ marginBottom: "var(--space-md)" }}>
              Agent Reputation
            </motion.div>

            {loading ? (
              <div className="empty-state">
                <div className="empty-state-icon">⏳</div>
                <div className="empty-state-title">Loading reputation data...</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {agents.map((agent) => {
                  const rep = reputations[agent.name]
                  const score = rep?.normalized ?? 0
                  const count = rep?.count ?? 0

                  return (
                    <motion.div
                      key={agent.name}
                      variants={fadeSlideUp}
                      className={`card ${selectedAgent === agent.name ? "card-copper" : ""}`}
                      style={{ cursor: "pointer", padding: "var(--space-md)" }}
                      onClick={() => setSelectedAgent(agent.name)}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: AGENT_COLORS[agent.name as AgentName],
                            }}
                          />
                          <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600 }}>
                            {agent.name.charAt(0).toUpperCase() + agent.name.slice(1)}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                            {count} attestations
                          </span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--copper-light)" }}>
                            {Math.round(score * 100)}%
                          </span>
                        </div>
                      </div>
                      <div style={{ marginTop: "var(--space-sm)" }}>
                        <ProgressBar value={score} color="var(--copper)" height={4} />
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <motion.div variants={fadeSlideUp} className="card">
              <div className="card-label" style={{ marginBottom: "var(--space-md)" }}>
                {selectedAgent ? `${selectedAgent.charAt(0).toUpperCase() + selectedAgent.slice(1)} Details` : "Select an Agent"}
              </div>

              {selectedRep ? (
                <div>
                  <div style={{ marginBottom: "var(--space-md)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-xs)" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>Normalized Score</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--copper-light)" }}>
                        {Math.round(selectedRep.normalized * 100)}%
                      </span>
                    </div>
                    <ProgressBar value={selectedRep.normalized} color="var(--copper)" height={8} />
                  </div>

                  <div style={{ marginBottom: "var(--space-md)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-xs)" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>Average Score</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                        {selectedRep.avg_score.toFixed(4)}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginBottom: "var(--space-md)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-xs)" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>Total Attestations</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                        {selectedRep.count}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", marginBottom: "var(--space-sm)" }}>
                      Signals
                    </div>
                    {selectedRep.signals.length === 0 ? (
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: "var(--space-md)" }}>
                        No signals recorded yet
                      </div>
                    ) : (
                      selectedRep.signals.map((signal, i) => (
                        <div key={i} style={{ padding: "var(--space-sm) 0", borderBottom: "1px solid var(--border-subtle)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-secondary)" }}>
                              Reviewer: {signal.reviewer}
                            </span>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--copper-light)" }}>
                              Score: {signal.score}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="empty-state" style={{ padding: "var(--space-xl) 0" }}>
                  <div className="empty-state-icon">📊</div>
                  <div className="empty-state-title">Select an agent</div>
                  <div className="empty-state-desc">Click on an agent to view detailed reputation data</div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </motion.main>
    </div>
  )
}
