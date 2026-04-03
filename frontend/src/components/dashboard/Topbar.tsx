"use client";

interface TopbarProps {
  title: string;
  connected: boolean;
  onRunCycle?: () => void;
}

export default function Topbar({ title, connected, onRunCycle }: TopbarProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 32px",
        borderBottom: "1px solid var(--dim)",
        background: "var(--deep)",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: "var(--white)",
        }}
      >
        {title}
      </h1>

      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            background: "var(--raised)",
            border: "1px solid var(--dim)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: 1,
            color: "var(--muted)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "999px",
              background: connected ? "var(--green)" : "var(--red)",
              animation: connected ? "pulse 2s infinite" : "none",
            }}
          />
          Base Sepolia
        </span>

        {onRunCycle && (
          <button
            onClick={onRunCycle}
            data-interactive
            style={{
              padding: "8px 20px",
              border: "1px solid var(--amber)",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--amber)",
              transition: "all var(--fast) var(--ease-out)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--amber)";
              e.currentTarget.style.color = "var(--void)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--amber)";
            }}
          >
            Run Cycle
          </button>
        )}
      </div>
    </header>
  );
}
