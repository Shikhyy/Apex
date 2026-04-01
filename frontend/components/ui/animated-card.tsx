"use client"

import { motion } from "framer-motion"
import { fadeSlideUp } from "@/lib/animations"
import type { ReactNode } from "react"

interface AnimatedCardProps {
  children: ReactNode
  glowColor?: string
  isActive?: boolean
  className?: string
  delay?: number
}

export function AnimatedCard({ children, glowColor, isActive, className = "", delay = 0 }: AnimatedCardProps) {
  return (
    <motion.div
      variants={fadeSlideUp}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -4 }}
      transition={{ delay, duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className={`card ${isActive && glowColor ? "card-copper" : ""} ${className}`}
    >
      {children}
    </motion.div>
  )
}
