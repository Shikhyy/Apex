"use client";

import { useEffect, useState } from "react";

interface DecisionBannerProps {
  decision: { approved: boolean; reason: string; confidence: number; detail: string; txHash?: string } | null;
}

export default function DecisionBanner({ decision }: DecisionBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (decision) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [decision]);

  if (!decision || !visible) return null;

  const approved = decision.approved;
  const color = approved ? "var(--green)" : "var(--red)";
  const bg = approved ? "#34d39915" : "#f8717115";

  return (
    <div
      style={{
        padding: "20px 32px",
        background: bg,
        border: `1px solid ${color}`,
        borderLeft: `4px solid ${color}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        animation: "vetoFlash 400ms var(--ease-out)",
      }}
      aria-live="polite"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 20 }}>{approved ? "✓" : "⊘"}</span>
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              letterSpacing: 3,
              color,
              fontWeight: 700,
            }}
          >
            {approved ? "APPROVED" : "VETOED"}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            {decision.reason} · {Math.round(decision.confidence * 100)}% confidence
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {decision.txHash && (
          <a
            href={`https://sepolia.etherscan.io/tx/${decision.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--amber)",
              textDecoration: "underline",
            }}
          >
            View tx ↗
          </a>
        )}
        <button
          onClick={() => setVisible(false)}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            color: "var(--muted)",
            padding: "4px 8px",
          }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
