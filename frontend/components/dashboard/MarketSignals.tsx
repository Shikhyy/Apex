"use client"

import { useEffect, useState } from "react"
import type { PrismPrice, PrismSignal, AerodromePool } from "@/lib/types"
import { fetchMarketPrices, fetchMarketSignals, fetchAerodromePools } from "@/lib/market"

const SIGNAL_COLORS: Record<string, string> = {
  BULLISH: "#22c55e",
  BEARISH: "#ef4444",
  NEUTRAL: "#f59e0b",
}

function fmtTvl(v: number) {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  return `$${v.toFixed(0)}`
}

export default function MarketSignals() {
  const [prices, setPrices] = useState<PrismPrice[]>([])
  const [signals, setSignals] = useState<PrismSignal[]>([])
  const [pools, setPools] = useState<AerodromePool[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"prices" | "signals" | "pools">("prices")

  useEffect(() => {
    Promise.all([fetchMarketPrices(), fetchMarketSignals(), fetchAerodromePools()])
      .then(([pRes, sRes, plRes]) => {
        setPrices(pRes.prices || [])
        setSignals(sRes.signals || [])
        setPools(plRes.pools || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
        Loading market data...
      </div>
    )
  }

  return (
    <div>
      {/* Tab Bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {(["prices", "signals", "pools"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              padding: "6px 12px",
              borderRadius: 3,
              border: "none",
              background: activeTab === tab ? "var(--scout)" : "var(--bg-overlay)",
              color: activeTab === tab ? "#fff" : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Prices Tab */}
      {activeTab === "prices" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {prices.map((p) => (
            <div
              key={p.symbol}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 12px",
                background: "var(--bg-deep)",
                border: "1px solid var(--border-default)",
                borderRadius: 4,
              }}
            >
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
                {p.symbol}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-secondary)" }}>
                ${p.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 700,
                  color: p.change_24h >= 0 ? "#22c55e" : "#ef4444",
                }}
              >
                {p.change_24h >= 0 ? "+" : ""}
                {p.change_24h.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Signals Tab */}
      {activeTab === "signals" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {signals.map((s) => (
            <div
              key={s.symbol}
              style={{
                padding: "10px 12px",
                background: "var(--bg-deep)",
                border: `1px solid ${SIGNAL_COLORS[s.signal]}40`,
                borderRadius: 4,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13 }}>{s.symbol}</span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 3,
                    background: `${SIGNAL_COLORS[s.signal]}20`,
                    color: SIGNAL_COLORS[s.signal],
                    border: `1px solid ${SIGNAL_COLORS[s.signal]}40`,
                  }}
                >
                  {s.signal}
                </span>
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
                {s.reasoning}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>
                Confidence: {Math.round(s.confidence * 100)}%
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pools Tab */}
      {activeTab === "pools" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pools.map((p) => (
            <div
              key={p.pool}
              style={{
                padding: "10px 12px",
                background: "var(--bg-deep)",
                border: "1px solid var(--border-default)",
                borderRadius: 4,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12 }}>{p.pool}</span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    padding: "1px 6px",
                    borderRadius: 2,
                    background: "#3b82f620",
                    color: "#3b82f6",
                    border: "1px solid #3b82f640",
                  }}
                >
                  BASE
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
                  APY: <span style={{ color: "#22c55e", fontWeight: 700 }}>{p.apy.toFixed(1)}%</span>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                  TVL: {fmtTvl(p.tvl_usd)}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                  Risk: {(p.risk_score * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
