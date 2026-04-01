"use client"

import { motion, AnimatePresence } from "framer-motion"
import { slideInRight, staggerContainer } from "@/lib/animations"

const AGENT_COLORS: Record<string, string> = {
  scout: "#888888",
  strategist: "#666666",
  guardian: "#a0a0a0",
  executor: "#555555",
}

const AGENT_LABELS: Record<string, string> = {
  scout: "SCOUT",
  strategist: "STRATEGIST",
  guardian: "GUARDIAN",
  executor: "EXECUTOR",
}

interface EventFeedItem {
  node: string
  timestamp: string
  data: Record<string, unknown>
}

interface EventFeedProps {
  feedItems: EventFeedItem[]
}

export function EventFeed({ feedItems }: EventFeedProps) {
  return (
    <div className="event-feed">
      <div className="event-feed-header">
        <span className="event-feed-title">Live Event Feed</span>
        {feedItems.length > 0 && (
          <span className="badge badge-muted">{feedItems.length} event{feedItems.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {feedItems.length === 0 ? (
        <div className="empty-state" style={{ padding: "var(--space-xl)" }}>
          <div className="empty-state-icon">📡</div>
          <div className="empty-state-title">Waiting for events</div>
          <div className="empty-state-desc">Events will appear here when cycles run</div>
        </div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="event-feed-list">
          <AnimatePresence mode="popLayout">
            {feedItems.map((item, i) => {
              const nodeKey = item.node
              const color = AGENT_COLORS[nodeKey] || "var(--text-muted)"
              const label = AGENT_LABELS[nodeKey] || item.node.toUpperCase()
              const jsonStr = JSON.stringify(item.data)
              const truncated = jsonStr.length > 80 ? jsonStr.slice(0, 80) + "…" : jsonStr
              const time = new Date(item.timestamp).toLocaleTimeString("en-US", { hour12: false })

              return (
                <motion.div
                  key={`${item.timestamp}-${i}`}
                  variants={slideInRight}
                  layout
                  className="event-feed-item"
                  style={{ borderLeftColor: color }}
                >
                  <div className="event-feed-item-header">
                    <span className="event-feed-item-label" style={{ color }}>
                      {label}
                    </span>
                    <span className="event-feed-item-time">{time}</span>
                  </div>
                  <div className="event-feed-item-data">{truncated}</div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
