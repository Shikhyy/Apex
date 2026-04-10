"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

interface TopbarProps {
  title: string;
  connected: boolean;
  automationEnabled?: boolean;
  automationRunning?: boolean;
}

export default function Topbar({
  title,
  connected,
  automationEnabled = true,
  automationRunning = true,
}: TopbarProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 32px",
        borderBottom: "1px solid rgba(213, 62, 15, 0.25)",
        background: "linear-gradient(180deg, rgba(13, 13, 13, 0.95), rgba(94, 0, 6, 0.18))",
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

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            background: automationEnabled
              ? "rgba(213, 62, 15, 0.12)"
              : "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(213, 62, 15, 0.22)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: 1,
            color: automationEnabled ? "var(--apex-burn)" : "var(--muted)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "999px",
              background: automationRunning ? "var(--apex-burn)" : "var(--muted)",
              animation: automationRunning ? "pulse 2s infinite" : "none",
            }}
          />
          {automationEnabled ? "Auto cycles on" : "Auto cycles off"}
        </span>

        <ConnectButton />
      </div>
    </header>
  );
}
