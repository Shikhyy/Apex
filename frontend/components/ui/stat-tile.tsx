"use client"

import { motion } from "framer-motion"
import { fadeSlideUp } from "@/lib/animations"

interface StatTileProps {
  label: string
  value: string
  color: string
  delay?: number
}

export function StatTile({ label, value, color, delay = 0 }: StatTileProps) {
  return (
    <motion.div
      variants={fadeSlideUp}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -4 }}
      transition={{ delay, duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className="stat-tile"
    >
      <motion.div
        className="stat-value"
        style={{ color }}
        layout
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {value}
      </motion.div>
      <div className="stat-label">{label}</div>
    </motion.div>
  )
}
