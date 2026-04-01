"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { staggerContainer, fadeSlideUp, slideInRight } from "@/lib/animations"
import { fetchHealth, triggerCycle } from "@/lib/api"
import type { SSEEvent } from "@/lib/types"
import { Sidebar } from "@/components/layout/sidebar"

interface CycleEntry {
  id: number
  timestamp: string
  status: "completed" | "running" | "failed"
  pnl: number
  vetoed: boolean
  txHash?: string
  duration: number
}

export default function CyclesPage() {
  const [cycles, setCycles] = useState<CycleEntry[]>([])
  const [running, setRunning] = useState(false)
  const [backendOk, setBackendOk] = useState(false)
  const [currentCycle, setCurrentCycle] = useState<CycleEntry | null>(null)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    fetchHealth()
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false))
  }, [])

  const handleSSEMessage = useCallback((e: MessageEvent) => {
    try {
      const evt: SSEEvent = JSON.parse(e.data)

      if (evt.node === "done") {
        const pnl = (evt.data.session_pnl as number) ?? 0
        const vetoCount = (evt.data.veto_count as number) ?? 0

        setCurrentCycle((prev) => {
          if (!prev) return null
          const completed = {
            ...prev,
            status: "completed" as const,
            pnl,
            vetoed: vetoCount > 0,
            duration: Date.now() - new Date(prev.timestamp).getTime(),
          }
          setCycles((prevCycles) => [completed, ...prevCycles])
          return null
        })
        setRunning(false)
      }
    } catch {
      // ignore parse errors
    }
  }, [])

  const handleRunCycle = useCallback(async () => {
    if (running) return
    setRunning(true)
    const newCycle: CycleEntry = {
      id: cycles.length + 1,
      timestamp: new Date().toISOString(),
      status: "running",
      pnl: 0,
      vetoed: false,
      duration: 0,
    }
    setCurrentCycle(newCycle)

    try {
      await triggerCycle()
      if (esRef.current) esRef.current.close()
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const es = new EventSource(`${API_BASE}/stream`)
      esRef.current = es
      es.onmessage = handleSSEMessage
      es.onerror = () => {
        setRunning(false)
        es.close()
        setCurrentCycle((prev) => prev ? { ...prev, status: "failed" } : null)
      }
    } catch {
      setRunning(false)
      setCurrentCycle((prev) => prev ? { ...prev, status: "failed" } : null)
    }
  }, [running, cycles.length, handleSSEMessage])

  useEffect(() => {
    return () => {
      if (esRef.current) esRef.current.close()
    }
  }, [])

  const fmtPnl = (v: number) => {
    const sign = v >= 0 ? "+" : ""
    return `${sign}$${v.toFixed(2)}`
  }

  const fmtDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const totalPnl = cycles.reduce((sum, c) => sum + c.pnl, 0)
  const vetoRate = cycles.length > 0 ? (cycles.filter((c) => c.vetoed).length / cycles.length) * 100 : 0
  const avgDuration = cycles.length > 0 ? cycles.reduce((sum, c) => sum + c.duration, 0) / cycles.length : 0

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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 className="page-title">Cycles</h1>
              <p className="page-subtitle">Execution history and cycle performance metrics</p>
            </div>
            <button
              className={`btn ${running || !backendOk ? "btn-secondary" : "btn-primary"}`}
              onClick={handleRunCycle}
              disabled={running || !backendOk}
            >
              {running ? "Running..." : "Run Cycle"}
            </button>
          </div>
        </div>

        <motion.div variants={fadeSlideUp} className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{cycles.length}</div>
            <div className="stat-label">Total Cycles</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: totalPnl >= 0 ? "var(--approved)" : "var(--vetoed)" }}>
              {fmtPnl(totalPnl)}
            </div>
            <div className="stat-label">Total PnL</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: "var(--vetoed)" }}>{vetoRate.toFixed(0)}%</div>
            <div className="stat-label">Veto Rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: "var(--copper)" }}>{fmtDuration(avgDuration)}</div>
            <div className="stat-label">Avg Duration</div>
          </div>
        </motion.div>

        {currentCycle && (
          <motion.div variants={slideInRight} className="card card-copper" style={{ marginBottom: "var(--space-lg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--copper)", animation: "pulse 1.5s ease infinite" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--copper-light)" }}>
                Cycle #{currentCycle.id} in progress...
              </span>
            </div>
          </motion.div>
        )}

        {cycles.length === 0 && !currentCycle ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔄</div>
            <div className="empty-state-title">No cycles yet</div>
            <div className="empty-state-desc">Run your first cycle to see execution history here</div>
          </div>
        ) : (
          <motion.div variants={fadeSlideUp} className="table-container">
            <div className="table-header" style={{ gridTemplateColumns: "60px 1fr 100px 100px 100px 80px" }}>
              <span>#</span>
              <span>Timestamp</span>
              <span>Status</span>
              <span>PnL</span>
              <span>Duration</span>
              <span>Vetoed</span>
            </div>
            <AnimatePresence>
              {cycles.map((cycle) => (
                <motion.div
                  key={cycle.id}
                  variants={slideInRight}
                  initial="hidden"
                  animate="visible"
                  className="table-row"
                  style={{ gridTemplateColumns: "60px 1fr 100px 100px 100px 80px" }}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>#{cycle.id}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}>
                    {new Date(cycle.timestamp).toLocaleString()}
                  </span>
                  <span>
                    <span className={`badge ${cycle.status === "completed" ? "badge-approved" : cycle.status === "failed" ? "badge-vetoed" : "badge-copper"}`}>
                      {cycle.status}
                    </span>
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: cycle.pnl >= 0 ? "var(--approved)" : "var(--vetoed)" }}>
                    {fmtPnl(cycle.pnl)}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
                    {fmtDuration(cycle.duration)}
                  </span>
                  <span>
                    <span className={`badge ${cycle.vetoed ? "badge-vetoed" : "badge-approved"}`}>
                      {cycle.vetoed ? "Yes" : "No"}
                    </span>
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </motion.main>
    </div>
  )
}
