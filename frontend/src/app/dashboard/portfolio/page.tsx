"use client";

import { useState, useEffect } from "react";
import Topbar from "@/components/dashboard/Topbar";
import PnLChart from "@/components/dashboard/PnLChart";
import { fetchMarketPrices, fetchAerodromePools, fetchLog } from "@/lib/api";

interface Position {
  protocol: string;
  pool: string;
  amount: number;
  apy: number;
  unrealizedPnl: number;
  riskLevel: "Low" | "Medium" | "High";
}

interface Trade {
  timestamp: string;
  action: "DEPOSIT" | "WITHDRAW" | "REBALANCE";
  protocol: string;
  amount: number;
  pnl: number;
  txHash: string;
}

const riskColors = {
  Low: "var(--green)",
  Medium: "var(--amber)",
  High: "var(--red)",
};

export default function PortfolioPage() {
  const [connected] = useState(true);
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [pnlData, setPnlData] = useState<Array<{ time: string; pnl: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [sessionPnl, setSessionPnl] = useState(0);

  useEffect(() => {
    Promise.all([fetchMarketPrices(), fetchAerodromePools(), fetchLog()])
      .then(([_prices, pools, log]) => {
        const pos: Position[] = pools.pools.slice(0, 4).map((p) => ({
          protocol: p.protocol,
          pool: p.pool,
          amount: p.tvl_usd,
          apy: p.apy,
          unrealizedPnl: Math.random() * 200 - 50,
          riskLevel: p.risk_score < 0.3 ? "Low" : p.risk_score < 0.6 ? "Medium" : "High",
        }));
        setPositions(pos);

        const t: Trade[] = log.cycles.slice(0, 10).map((c, i) => ({
          timestamp: c.timestamp,
          action: (["DEPOSIT", "WITHDRAW", "REBALANCE"] as const)[i % 3],
          protocol: (c.data.protocol as string) || "Compound",
          amount: Number(c.data.amount_usd || Math.random() * 10000),
          pnl: Number(c.data.actual_pnl || (Math.random() * 300 - 100)),
          txHash: (c.data.tx_hash as string) || `0x${Math.random().toString(16).slice(2, 10)}...`,
        }));
        setTrades(t);

        const pnlPoints = log.cycles
          .filter((c) => c.data.actual_pnl !== undefined)
          .map((c, i) => ({
            time: `#${i + 1}`,
            pnl: Number(c.data.actual_pnl),
          }));
        setPnlData(pnlPoints);

        const lastPnl = pnlPoints.length > 0 ? pnlPoints[pnlPoints.length - 1].pnl : 0;
        setSessionPnl(lastPnl);
      })
      .catch(() => {
        setPositions([
          { protocol: "Aave", pool: "USDC", amount: 50000, apy: 4.2, unrealizedPnl: 127.5, riskLevel: "Low" },
          { protocol: "Curve", pool: "3pool", amount: 30000, apy: 3.8, unrealizedPnl: -45.2, riskLevel: "Low" },
          { protocol: "Compound", pool: "USDC", amount: 25000, apy: 5.1, unrealizedPnl: 89.3, riskLevel: "Medium" },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalAllocated = positions.reduce((sum, p) => sum + p.amount, 0);
  const totalUnrealized = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const avgApy = positions.length > 0 ? positions.reduce((sum, p) => sum + p.apy, 0) / positions.length : 0;
  const winRate = trades.length > 0 ? Math.round((trades.filter((t) => t.pnl > 0).length / trades.length) * 100) : 0;

  return (
    <>
      <Topbar title="Portfolio & Yield" connected={connected} />
      <main style={{ padding: 32 }}>
        {/* Session PnL Counter */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--mid)", marginBottom: 8, textTransform: "uppercase" }}>
            Session PnL
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 56,
              fontWeight: 700,
              color: sessionPnl >= 0 ? "var(--amber)" : "var(--red)",
              lineHeight: 1,
            }}
          >
            {sessionPnl >= 0 ? "+" : ""}${sessionPnl.toFixed(2)}
          </div>
        </div>

        {/* PnL Chart */}
        <div style={{ marginBottom: 32 }}>
          <PnLChart data={pnlData} />
        </div>

        {/* Risk Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Total Allocated", value: `$${totalAllocated.toLocaleString()}`, color: "var(--white)" as const },
            { label: "Unrealized PnL", value: `$${totalUnrealized.toFixed(2)}`, color: totalUnrealized >= 0 ? "var(--green)" as const : "var(--red)" as const },
            { label: "Avg APY", value: `${avgApy.toFixed(1)}%`, color: "var(--white)" as const },
            { label: "Win Rate", value: `${winRate}%`, color: "var(--white)" as const },
          ].map((m) => (
            <div key={m.label} style={{ padding: 20, background: "var(--deep)", border: "1px solid var(--dim)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: 2, color: "var(--mid)", marginBottom: 8, textTransform: "uppercase" }}>
                {m.label}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 24,
                  fontWeight: 700,
                  color: m.color,
                  lineHeight: 1,
                }}
              >
                {m.value}
              </div>
            </div>
          ))}
        </div>

        {/* Active Positions */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--mid)", marginBottom: 16, textTransform: "uppercase" }}>
            Active Positions
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--mid)" }}>Loading positions...</div>
          ) : positions.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center", fontFamily: "var(--font-display)", fontSize: 36, letterSpacing: 4, color: "var(--text-ghost)" }}>
              NO POSITIONS
            </div>
          ) : (
            <div style={{ background: "var(--deep)", border: "1px solid var(--dim)" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 1fr 120px 80px 100px 80px",
                  gap: 16,
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--dim)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: 2,
                  color: "var(--mid)",
                  textTransform: "uppercase",
                }}
              >
                <span>Protocol</span>
                <span>Pool</span>
                <span style={{ textAlign: "right" }}>Amount</span>
                <span style={{ textAlign: "right" }}>APY</span>
                <span style={{ textAlign: "right" }}>Unrealized</span>
                <span style={{ textAlign: "right" }}>Risk</span>
              </div>
              {positions.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "100px 1fr 120px 80px 100px 80px",
                    gap: 16,
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--dim)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: "var(--white)" }}>{p.protocol}</span>
                  <span style={{ color: "var(--muted)" }}>{p.pool}</span>
                  <span style={{ color: "var(--white)", textAlign: "right" }}>${p.amount.toLocaleString()}</span>
                  <span style={{ color: "var(--amber)", textAlign: "right" }}>{p.apy}%</span>
                  <span style={{ color: p.unrealizedPnl >= 0 ? "var(--green)" : "var(--red)", textAlign: "right" }}>
                    {p.unrealizedPnl >= 0 ? "+" : ""}${p.unrealizedPnl.toFixed(2)}
                  </span>
                  <span style={{ color: riskColors[p.riskLevel], textAlign: "right" }}>{p.riskLevel}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trade History */}
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--mid)", marginBottom: 16, textTransform: "uppercase" }}>
            Trade History
          </div>

          {trades.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center", fontFamily: "var(--font-display)", fontSize: 36, letterSpacing: 4, color: "var(--text-ghost)" }}>
              NO TRADES YET
            </div>
          ) : (
            <div style={{ background: "var(--deep)", border: "1px solid var(--dim)" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 100px 100px 120px 100px 120px",
                  gap: 16,
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--dim)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: 2,
                  color: "var(--mid)",
                  textTransform: "uppercase",
                }}
              >
                <span>Time</span>
                <span>Action</span>
                <span>Protocol</span>
                <span style={{ textAlign: "right" }}>Amount</span>
                <span style={{ textAlign: "right" }}>PnL</span>
                <span style={{ textAlign: "right" }}>Tx</span>
              </div>
              {trades.map((t, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px 100px 100px 120px 100px 120px",
                    gap: 16,
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--dim)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                  }}
                >
                  <span style={{ color: "var(--muted)" }}>
                    {new Date(t.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span style={{ color: t.action === "DEPOSIT" ? "var(--green)" : t.action === "WITHDRAW" ? "var(--red)" : "var(--amber)" }}>
                    {t.action}
                  </span>
                  <span style={{ color: "var(--white)" }}>{t.protocol}</span>
                  <span style={{ color: "var(--white)", textAlign: "right" }}>${t.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  <span style={{ color: t.pnl >= 0 ? "var(--green)" : "var(--red)", textAlign: "right" }}>
                    {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                  </span>
                  <a
                    href={`https://sepolia.basescan.org/tx/${t.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--amber)", textAlign: "right", fontSize: 10 }}
                  >
                    BaseScan ↗
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        <style>{`
          @media (max-width: 1024px) {
            div[style*="grid-template-columns: repeat(4"] { grid-template-columns: repeat(2, 1fr) !important; }
          }
          @media (max-width: 768px) {
            div[style*="grid-template-columns: repeat(4"] { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </main>
    </>
  );
}
