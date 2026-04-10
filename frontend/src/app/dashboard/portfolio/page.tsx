"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import Topbar from "@/components/dashboard/Topbar";
import PnLChart from "@/components/dashboard/PnLChart";
import { fetchAerodromePools, fetchLog } from "@/lib/api";

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
  action: string;
  protocol: string;
  amount: number;
  pnl: number;
  txHash: string;
}

const riskColors: Record<string, string> = {
  Low: "var(--green)",
  Medium: "var(--apex-burn)",
  High: "var(--red)",
};

export default function PortfolioPage() {
  const { isConnected } = useAccount();
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [pnlData, setPnlData] = useState<Array<{ time: string; pnl: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [sessionPnl, setSessionPnl] = useState(0);

  useEffect(() => {
    Promise.all([fetchAerodromePools(), fetchLog()])
      .then(([pools, log]) => {
        const sortedCycles = [...log.cycles]
          .filter((c: { data: Record<string, unknown> }) => c.data.actual_pnl !== undefined)
          .sort((a: { timestamp: string }, b: { timestamp: string }) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const pos: Position[] = pools.pools
          .filter((p: { tvl_usd: number }) => p.tvl_usd > 0)
          .slice(0, 4)
          .map((p: { protocol: string; pool: string; tvl_usd: number; apy: number; risk_score: number }) => ({
            protocol: p.protocol,
            pool: p.pool,
            amount: p.tvl_usd,
            apy: p.apy,
            unrealizedPnl: 0,
            riskLevel: p.risk_score < 0.3 ? "Low" : p.risk_score < 0.6 ? "Medium" : "High",
          }));
        setPositions(pos);

        const t: Trade[] = [...sortedCycles]
          .filter((c: { data: Record<string, unknown> }) => c.data.tx_hash !== undefined)
          .slice(-10)
          .reverse()
          .map((c: { timestamp: string; data: Record<string, unknown>; node: string }) => ({
            timestamp: c.timestamp,
            action: c.node.toUpperCase(),
            protocol: (c.data.protocol as string) || "—",
            amount: Number(c.data.amount_usd || 0),
            pnl: Number(c.data.actual_pnl || 0),
            txHash: (c.data.tx_hash as string) || "",
          }));
        setTrades(t);

        let runningPnl = 0;
        const pnlPoints = sortedCycles.map((c: { data: Record<string, unknown> }, i: number) => {
          runningPnl += Number(c.data.actual_pnl || 0);
          return {
            time: `#${i + 1}`,
            pnl: runningPnl,
          };
        });
        setPnlData(pnlPoints);

        setSessionPnl(runningPnl);
      })
      .catch(() => {
        setPositions([]);
        setTrades([]);
        setPnlData([]);
        setSessionPnl(0);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalAllocated = positions.reduce((sum, p) => sum + p.amount, 0);
  const totalUnrealized = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const avgApy = positions.length > 0 ? positions.reduce((sum, p) => sum + p.apy, 0) / positions.length : 0;
  const winRate = trades.length > 0 ? Math.round((trades.filter((t) => t.pnl > 0).length / trades.length) * 100) : 0;

  return (
    <>
      <Topbar title="Portfolio & Yield" connected={isConnected} />
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
              color: sessionPnl >= 0 ? "var(--apex-burn)" : "var(--red)",
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
        {positions.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
            {[
              { label: "Total Allocated", value: `$${totalAllocated.toLocaleString()}`, color: "var(--white)" as const, sparkColor: "var(--apex-burn)" as const },
              { label: "Unrealized PnL", value: `$${totalUnrealized.toFixed(2)}`, color: totalUnrealized >= 0 ? "var(--green)" as const : "var(--red)" as const, sparkColor: totalUnrealized >= 0 ? "var(--green)" as const : "var(--red)" as const },
              { label: "Avg APY", value: `${avgApy.toFixed(1)}%`, color: "var(--white)" as const, sparkColor: "var(--apex-burn)" as const },
              { label: "Win Rate", value: `${winRate}%`, color: "var(--white)" as const, sparkColor: winRate > 50 ? "var(--green)" as const : "var(--red)" as const },
            ].map((m) => (
              <div key={m.label} style={{ padding: 20, background: "var(--deep)", border: "1px solid var(--dim)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: 2, color: "var(--mid)", marginBottom: 8, textTransform: "uppercase" }}>
                  {m.label}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, color: m.color, lineHeight: 1 }}>
                  {m.value}
                </div>
                <Sparkline color={m.sparkColor} />
              </div>
            ))}
          </div>
        )}

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
                  <span style={{ color: "var(--apex-burn)", textAlign: "right" }}>{p.apy}%</span>
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
                  <span style={{ color: "var(--apex-burn)" }}>
                    {t.action}
                  </span>
                  <span style={{ color: "var(--white)" }}>{t.protocol}</span>
                  <span style={{ color: "var(--white)", textAlign: "right" }}>${t.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  <span style={{ color: t.pnl >= 0 ? "var(--green)" : "var(--red)", textAlign: "right" }}>
                    {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                  </span>
                  {t.txHash ? (
                    <a
                      href={`https://sepolia.basescan.org/tx/${t.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--apex-burn)", textAlign: "right", fontSize: 10 }}
                    >
                      BaseScan ↗
                    </a>
                  ) : (
                    <span style={{ color: "var(--mid)", textAlign: "right", fontSize: 10 }}>—</span>
                  )}
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

function Sparkline({ color }: { color: string }) {
  return (
    <div style={{ marginTop: 8, height: 30, display: "flex", alignItems: "center" }}>
      <div style={{ width: "100%", height: 2, background: "var(--dim)" }}>
        <div style={{ width: "100%", height: "100%", background: color }} />
      </div>
    </div>
  );
}
