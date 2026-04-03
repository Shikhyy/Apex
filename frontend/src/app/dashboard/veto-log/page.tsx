"use client";

import { useState, useEffect } from "react";
import Topbar from "@/components/dashboard/Topbar";
import VetoRow from "@/components/dashboard/VetoRow";
import { fetchLog } from "@/lib/api";
import type { VetoEntry } from "@/lib/types";

export default function VetoLogPage() {
  const [connected] = useState(true);
  const [vetoes, setVetoes] = useState<VetoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterReason, setFilterReason] = useState<string>("all");
  const [filterConfidence, setFilterConfidence] = useState<number>(0);

  useEffect(() => {
    fetchLog()
      .then((data) => {
        const entries: VetoEntry[] = data.cycles
          .filter((c) => c.node === "guardian" && (c.data as Record<string, unknown>).guardian_decision === "vetoed")
          .map((c) => ({
            timestamp: c.timestamp,
            reason: (c.data.guardian_reason as string) || "unknown",
            detail: (c.data.guardian_detail as string) || "",
            confidence: Number(c.data.guardian_confidence || 0),
            txHash: (c.data.tx_hash as string) || "",
          }));
        setVetoes(entries);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = vetoes.filter((v) => {
    if (filterReason !== "all" && v.reason !== filterReason) return false;
    if (v.confidence < filterConfidence) return false;
    return true;
  });

  const reasons = Array.from(new Set(vetoes.map((v) => v.reason)));
  const avgConfidence = vetoes.length > 0 ? vetoes.reduce((sum, v) => sum + v.confidence, 0) / vetoes.length : 0;
  const mostCommonReason = reasons.length > 0
    ? reasons.reduce((a, b) =>
        vetoes.filter((v) => v.reason === a).length > vetoes.filter((v) => v.reason === b).length ? a : b
      )
    : "—";

  const handleExportCSV = () => {
    const header = "Timestamp,Reason,Detail,Confidence,TxHash\n";
    const rows = filtered.map((v) =>
      `"${v.timestamp}","${v.reason}","${v.detail}",${v.confidence},"${v.txHash}"`
    );
    const csv = header + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "apex-veto-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Topbar title="Veto Log" connected={connected} />
      <main style={{ padding: 32 }}>
        {/* Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Total Vetoes", value: String(vetoes.length) },
            { label: "Avg Confidence", value: `${Math.round(avgConfidence * 100)}%` },
            { label: "Most Common", value: mostCommonReason },
            { label: "Showing", value: `${filtered.length} / ${vetoes.length}` },
          ].map((s) => (
            <div key={s.label} style={{ padding: 20, background: "var(--deep)", border: "1px solid var(--dim)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: 2, color: "var(--mid)", marginBottom: 8, textTransform: "uppercase" }}>
                {s.label}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, color: "var(--white)", lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filter Bar */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 24,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <select
            value={filterReason}
            onChange={(e) => setFilterReason(e.target.value)}
            style={{
              padding: "8px 12px",
              background: "var(--deep)",
              border: "1px solid var(--dim)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--white)",
            }}
          >
            <option value="all">All Reasons</option>
            {reasons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--mid)" }}>Min Confidence:</span>
            <input
              type="range"
              min={0}
              max={100}
              value={filterConfidence * 100}
              onChange={(e) => setFilterConfidence(Number(e.target.value) / 100)}
              style={{ width: 120 }}
            />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--amber)" }}>
              {Math.round(filterConfidence * 100)}%
            </span>
          </div>

          {(filterReason !== "all" || filterConfidence > 0) && (
            <button
              onClick={() => {
                setFilterReason("all");
                setFilterConfidence(0);
              }}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--muted)",
                padding: "4px 12px",
                border: "1px solid var(--dim)",
              }}
            >
              Clear
            </button>
          )}

          <div style={{ flex: 1 }} />

          {vetoes.length > 0 && (
            <button
              onClick={handleExportCSV}
              data-interactive
              style={{
                padding: "8px 16px",
                border: "1px solid var(--amber)",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: 1,
                color: "var(--amber)",
              }}
            >
              Export CSV
            </button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--mid)" }}>
            Loading veto history...
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: 80,
              textAlign: "center",
              fontFamily: "var(--font-display)",
              fontSize: 48,
              letterSpacing: 6,
              color: "var(--text-ghost)",
            }}
          >
            NO VETOES YET
          </div>
        ) : (
          <div style={{ background: "var(--deep)", border: "1px solid var(--dim)" }}>
            {/* Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "80px 70px 130px 1fr 60px 120px",
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
              <span>Badge</span>
              <span>Reason</span>
              <span>Detail</span>
              <span>Conf</span>
              <span style={{ textAlign: "right" }}>Tx</span>
            </div>

            {/* Rows */}
            {filtered.map((v, i) => (
              <VetoRow key={i} {...v} />
            ))}
          </div>
        )}

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
