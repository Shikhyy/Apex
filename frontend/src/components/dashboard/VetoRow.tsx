"use client";

interface VetoRowProps {
  timestamp: string;
  reason: string;
  detail: string;
  confidence: number;
  txHash: string;
}

export default function VetoRow({ timestamp, reason, detail, confidence, txHash }: VetoRowProps) {
  const time = new Date(timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "80px 70px 130px 1fr 60px 120px",
        gap: 16,
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: "1px solid var(--dim)",
        transition: "background var(--fast)",
        animation: "fadeIn 400ms var(--ease-out)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#111")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>{time}</span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: 1,
          color: "var(--red)",
          padding: "2px 8px",
          border: "1px solid var(--red)",
          textAlign: "center",
        }}
      >
        VETO
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--white)" }}>{reason}</span>
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 12,
          color: "var(--muted)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {detail}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--amber)" }}>{Math.round(confidence * 100)}%</span>
      <a
        href={`https://sepolia.etherscan.io/tx/${txHash}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--amber)",
          textAlign: "right",
        }}
      >
        Etherscan ↗
      </a>
    </div>
  );
}
