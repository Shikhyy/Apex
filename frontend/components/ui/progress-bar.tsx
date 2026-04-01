"use client"

import { motion } from "framer-motion"

interface ProgressBarProps {
  value: number
  color: string
  height?: number
}

export function ProgressBar({ value, color, height = 4 }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value * 100))

  return (
    <div className="progress-bar-track">
      <motion.div
        className="progress-bar-fill"
        style={{ background: color, height }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      />
    </div>
  )
}
