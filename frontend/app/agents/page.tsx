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

const AGENT_DESCRIPTIONS: Record<AgentName, string> = {
  scout: "Monitors market conditions, tracks volatility, and identifies yield opportunities across protocols.",
  strategist: "Generates trade intents based on scout data, ranks opportunities by risk-adjusted returns.",
  guardian: "Risk management layer that vets every trade intent. Can veto dangerous trades with on-chain attestation.",
  executor: "Executes approved trades via Surge Risk Router and Kraken CLI. Records on-chain proof of execution.",
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [reputations, setReputations] = useState<Record<string, ReputationResponse | null>>({})
  const [loading, setLoading] = useState(true)

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
          <h1 className="page-title">Agents</h1>
          <p className="page-subtitle">ERC-8004 registered agents and their on-chain reputation</p>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-title">Loading agents...</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
            {agents.map((agent) => {
              const rep = reputations[agent.name]
              const repScore = rep?.normalized ?? 0
              const repCount = rep?.count ?? 0

              return (
                <motion.div
                  key={agent.name}
                  variants={fadeSlideUp}
                  className="card"
                  style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "var(--space-xl)", alignItems: "center" }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: AGENT_COLORS[agent.name as AgentName],
                        }}
                      />
                      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, letterSpacing: "-0.3px" }}>
                        {agent.name.charAt(0).toUpperCase() + agent.name.slice(1)}
                      </h3>
                      <span className="badge badge-muted">#{agent.agent_id}</span>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: "var(--space-md)", lineHeight: 1.6 }}>
                      {AGENT_DESCRIPTIONS[agent.name as AgentName]}
                    </p>
                    <div className="badge badge-copper">{agent.role}</div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-xs)" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>
                        Reputation Score
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--copper-light)" }}>
                        {Math.round(repScore * 100)}%
                      </span>
                    </div>
                    <ProgressBar value={repScore} color="var(--copper)" height={6} />
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginTop: "var(--space-xs)" }}>
                      {repCount} attestation{repCount !== 1 ? "s" : ""}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.main>
    </div>
  )
}
