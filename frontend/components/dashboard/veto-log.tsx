"use client"

import { motion, AnimatePresence } from "framer-motion"
import { slideInRight, staggerContainer } from "@/lib/animations"

interface VetoRowData {
  timestamp: string
  reason: string
  detail: string
  confidence: number
  txHash?: string
}

interface VetoLogProps {
  vetoRows: VetoRowData[]
}

export function VetoLog({ vetoRows }: VetoLogProps) {
  return (
    <div className="veto-log">
      <div className="veto-log-header">
        <span className="veto-log-title">Veto Log</span>
        {vetoRows.length > 0 && (
          <span className="badge badge-vetoed">{vetoRows.length} veto{vetoRows.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {vetoRows.length === 0 ? (
        <div className="empty-state" style={{ padding: "var(--space-xl)" }}>
          <div className="empty-state-icon">🛡️</div>
          <div className="empty-state-title">No vetoes yet</div>
          <div className="empty-state-desc">Run a cycle to begin monitoring</div>
        </div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="table-container">
          <div className="table-header" style={{ gridTemplateColumns: "80px 64px 1fr 2fr 48px" }}>
            <span>Time</span>
            <span>Type</span>
            <span>Reason</span>
            <span>Detail</span>
            <span>Confidence</span>
          </div>
          <AnimatePresence mode="popLayout">
            {vetoRows.map((row, i) => (
              <motion.div
                key={`${row.timestamp}-${i}`}
                variants={slideInRight}
                layout
                className="table-row"
                style={{ gridTemplateColumns: "80px 64px 1fr 2fr 48px" }}
                onClick={() => {
                  if (row.txHash) window.open(`https://sepolia.basescan.org/tx/${row.txHash}`, "_blank")
                }}
              >
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>{row.timestamp}</span>
                <span><span className="badge badge-vetoed">VETO</span></span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--copper-light)" }}>{row.reason}</span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.detail}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", textAlign: "right" }}>
                  {Math.round(row.confidence * 100)}%
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
