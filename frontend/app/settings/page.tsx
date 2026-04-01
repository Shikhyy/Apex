"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { staggerContainer, fadeSlideUp } from "@/lib/animations"
import { Sidebar } from "@/components/layout/sidebar"

export default function SettingsPage() {
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

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
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure APEX system parameters and preferences</p>
        </div>

        {saved && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="card card-copper"
            style={{ marginBottom: "var(--space-lg)", padding: "var(--space-sm) var(--space-md)" }}
          >
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--copper-light)" }}>
              Settings saved successfully
            </span>
          </motion.div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-xl)" }}>
          <motion.div variants={fadeSlideUp} className="card">
            <h3 className="card-title" style={{ marginBottom: "var(--space-lg)" }}>Backend Configuration</h3>

            <div className="form-group">
              <label className="form-label">API Endpoint</label>
              <input
                className="form-input"
                type="text"
                defaultValue={process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}
                placeholder="http://localhost:8000"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Identity Registry Address</label>
              <input
                className="form-input"
                type="text"
                defaultValue="0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
                placeholder="0x..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Reputation Registry Address</label>
              <input
                className="form-input"
                type="text"
                defaultValue="0x8004BAa17C55a88189AE136b182e5fdA19dE9b63"
                placeholder="0x..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Network</label>
              <select className="form-input form-select" defaultValue="base-sepolia">
                <option value="base-sepolia">Base Sepolia</option>
                <option value="base-mainnet">Base Mainnet</option>
              </select>
            </div>
          </motion.div>

          <motion.div variants={fadeSlideUp} className="card">
            <h3 className="card-title" style={{ marginBottom: "var(--space-lg)" }}>Agent Parameters</h3>

            <div className="form-group">
              <label className="form-label">Guardian Veto Threshold</label>
              <input
                className="form-input"
                type="number"
                defaultValue="0.7"
                min="0"
                max="1"
                step="0.1"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Max Volatility Index</label>
              <input
                className="form-input"
                type="number"
                defaultValue="50"
                min="0"
                max="100"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Min Liquidity (USD)</label>
              <input
                className="form-input"
                type="number"
                defaultValue="100000"
                min="0"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Max Position Size (USD)</label>
              <input
                className="form-input"
                type="number"
                defaultValue="10000"
                min="0"
              />
            </div>
          </motion.div>

          <motion.div variants={fadeSlideUp} className="card">
            <h3 className="card-title" style={{ marginBottom: "var(--space-lg)" }}>Display Preferences</h3>

            <div className="form-group">
              <label className="form-label">Event Feed Limit</label>
              <input
                className="form-input"
                type="number"
                defaultValue="50"
                min="10"
                max="200"
              />
            </div>

            <div className="form-group">
              <label className="form-label">PnL Decimal Places</label>
              <input
                className="form-input"
                type="number"
                defaultValue="2"
                min="0"
                max="4"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Timezone</label>
              <select className="form-input form-select" defaultValue="utc">
                <option value="utc">UTC</option>
                <option value="local">Local Time</option>
              </select>
            </div>
          </motion.div>

          <motion.div variants={fadeSlideUp} className="card">
            <h3 className="card-title" style={{ marginBottom: "var(--space-lg)" }}>System Information</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              {[
                { label: "Version", value: "1.0.0" },
                { label: "Framework", value: "Next.js 15" },
                { label: "Backend", value: "FastAPI + LangGraph" },
                { label: "AI Provider", value: "Groq LPU" },
                { label: "Standard", value: "ERC-8004" },
                { label: "License", value: "MIT" },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-sm) 0", borderBottom: "1px solid var(--border-subtle)" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>{item.label}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>{item.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div variants={fadeSlideUp} style={{ marginTop: "var(--space-xl)", display: "flex", justifyContent: "flex-end" }}>
          <button className="btn btn-primary" onClick={handleSave}>
            Save Settings
          </button>
        </motion.div>
      </motion.main>
    </div>
  )
}
