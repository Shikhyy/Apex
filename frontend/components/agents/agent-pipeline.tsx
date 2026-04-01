"use client"

import { motion } from "framer-motion"
import { staggerContainer, fadeSlideUp, pulseGlow } from "@/lib/animations"

const AGENT_COLORS: Record<string, string> = {
  scout: "#888888",
  strategist: "#666666",
  guardian: "#a0a0a0",
  executor: "#555555",
}

const NODES = [
  { key: "scout", label: "SCOUT" },
  { key: "strategist", label: "STRATEGIST" },
  { key: "guardian", label: "GUARDIAN" },
  { key: "executor", label: "EXECUTOR" },
]

interface AgentPipelineProps {
  activeNode: string | null
}

export function AgentPipeline({ activeNode }: AgentPipelineProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="agent-pipeline"
    >
      {NODES.map((node, i) => (
        <div key={node.key} className="agent-pipeline-node-wrapper">
          <motion.div
            variants={fadeSlideUp}
            className={`agent-pipeline-node ${activeNode === node.key ? "active" : ""}`}
            style={
              activeNode === node.key
                ? ({
                    "--node-color": AGENT_COLORS[node.key],
                  } as React.CSSProperties)
                : undefined
            }
          >
            <span className="agent-pipeline-label" style={{ color: activeNode === node.key ? AGENT_COLORS[node.key] : "var(--text-muted)" }}>
              {node.label}
            </span>
            {activeNode === node.key && (
              <motion.span
                className="agent-pipeline-dot"
                style={{ background: AGENT_COLORS[node.key] }}
                variants={pulseGlow}
                animate="active"
              />
            )}
          </motion.div>

          {i < NODES.length - 1 && (
            <div className="agent-pipeline-connector">
              <motion.div
                className="agent-pipeline-arrow"
                style={{ color: activeNode === node.key ? AGENT_COLORS[node.key] : "var(--border-default)" }}
                animate={{ opacity: activeNode === node.key ? 1 : 0.5 }}
                transition={{ duration: 0.3 }}
              >
                →
              </motion.div>
              {activeNode === node.key && (
                <motion.div
                  className="agent-pipeline-flow-dot"
                  style={{ background: AGENT_COLORS[node.key] }}
                  initial={{ x: 0, opacity: 0 }}
                  animate={{ x: 20, opacity: 1 }}
                  transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 0.5 }}
                />
              )}
            </div>
          )}
        </div>
      ))}
    </motion.div>
  )
}
