"use client"

import { StatusBadge } from "@/components/ui/status-badge"
import { ProgressBar } from "@/components/ui/progress-bar"
import { AnimatedCard } from "@/components/ui/animated-card"

const AGENT_LABELS: Record<string, string> = {
  scout: "SCOUT",
  strategist: "STRATEGIST",
  guardian: "GUARDIAN",
  executor: "EXECUTOR",
}

interface AgentCardProps {
  name: string
  status: "ready" | "running" | "idle" | "error"
  repScore: number
  agentId: number
  delay?: number
}

export function AgentCard({ name, status, repScore, agentId, delay = 0 }: AgentCardProps) {
  const isRunning = status === "running"

  return (
    <AnimatedCard glowColor="var(--copper)" isActive={isRunning} delay={delay}>
      <div className="agent-card-header">
        <div className="agent-card-identity">
          <StatusBadge status={status} color={isRunning ? "var(--copper)" : undefined} />
          <span className="agent-name" style={{ color: isRunning ? "var(--copper-light)" : "var(--text-secondary)" }}>
            {AGENT_LABELS[name]}
          </span>
        </div>
        <span className="agent-id">#{agentId || "—"}</span>
      </div>

      <div className="agent-card-rep">
        <ProgressBar value={repScore} color={isRunning ? "var(--copper)" : "var(--text-muted)"} />
        <span className="agent-rep-pct">{Math.round(repScore * 100)}%</span>
      </div>

      <div className="agent-card-role">{name}</div>
    </AnimatedCard>
  )
}
