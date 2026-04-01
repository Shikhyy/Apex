"use client"

import { motion } from "framer-motion"
import { scaleIn, pulseGlow } from "@/lib/animations"

const STATUS_COLORS: Record<string, string> = {
  ready: "#555555",
  running: "var(--copper)",
  idle: "#333333",
  error: "var(--vetoed)",
}

interface StatusBadgeProps {
  status: string
  color?: string
}

export function StatusBadge({ status, color }: StatusBadgeProps) {
  const dotColor = color || STATUS_COLORS[status] || STATUS_COLORS.idle
  const isRunning = status === "running"

  return (
    <motion.div
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      className="status-badge"
    >
      <motion.span
        className="status-dot"
        style={{ background: dotColor }}
        variants={pulseGlow}
        animate={isRunning ? "active" : "idle"}
      />
      <span className="status-text">{status}</span>
    </motion.div>
  )
}
