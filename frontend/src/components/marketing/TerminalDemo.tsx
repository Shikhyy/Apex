"use client";

import { useEffect, useState, useRef } from "react";
import RevealText from "@/components/ui/RevealText";

const lines = [
  { text: "> Initializing APEX cycle #42...", color: "var(--muted)" },
  { text: "[SCOUT] Scanning 12 protocols...", color: "var(--apex-cream)" },
  { text: "  Found 3 opportunities: Aave USDC 4.2%, Curve 3.8%, Compound 5.1%", color: "var(--dim)" },
  { text: "[STRATEGIST] Ranking intents...", color: "var(--apex-burn)" },
  { text: "  #1 Compound USDC — APY 5.1%, Risk 0.23, Confidence 0.87", color: "var(--dim)" },
  { text: "[GUARDIAN] Running risk checks...", color: "var(--apex-dark-red)" },
  { text: "  Volatility: 0.18 ✓  Drawdown: 2.1% ✓  Reputation: 94 ✓", color: "var(--dim)" },
  { text: "  Decision: APPROVED", color: "var(--apex-burn)" },
  { text: "[EXECUTOR] Deploying $50,000 to Compound USDC...", color: "var(--apex-burn)" },
  { text: "  Tx: 0x8f3a...c72d", color: "var(--dim)" },
  { text: "  P&L: +$127.50 (0.255%)", color: "var(--apex-cream)" },
  { text: "> Cycle complete.", color: "var(--muted)" },
];

export default function TerminalDemo() {
  const [visible, setVisible] = useState(0);
  const started = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          let i = 0;
          const interval = setInterval(() => {
            i++;
            setVisible(i);
            if (i >= lines.length) clearInterval(interval);
          }, 200);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section style={{ padding: "var(--space-40) 40px", maxWidth: 900, margin: "0 auto" }}>
      <RevealText>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(32px, 5vw, 64px)",
            letterSpacing: 3,
            lineHeight: 1,
            marginBottom: 48,
          }}
        >
          LIVE CYCLE
        </h2>
      </RevealText>

      <div
        ref={ref}
        style={{
          background: "linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(94, 0, 6, 0.2))",
          border: "1px solid rgba(213, 62, 15, 0.35)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(213, 62, 15, 0.3)", display: "flex", gap: 8 }}>
          <span style={{ width: 12, height: 12, borderRadius: "999px", background: "#ff5f57" }} />
          <span style={{ width: 12, height: 12, borderRadius: "999px", background: "#febc2e" }} />
          <span style={{ width: 12, height: 12, borderRadius: "999px", background: "#28c840" }} />
        </div>

        <div style={{ padding: 24, fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.9 }}>
          {lines.slice(0, visible).map((line, i) => (
            <div
              key={i}
              style={{
                color: line.color,
                animation: "terminalLine 300ms var(--ease-out) both",
                animationDelay: `${i * 80}ms`,
              }}
            >
              {line.text}
            </div>
          ))}
          {visible < lines.length && (
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 16,
                background: "var(--apex-burn)",
                animation: "pulse 1s infinite",
                verticalAlign: "middle",
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}
