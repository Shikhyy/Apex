"use client";

import { useRef, useState } from "react";
import RevealText from "@/components/ui/RevealText";

const agents = [
  {
    name: "SCOUT",
    role: "Market Intelligence",
    color: "#EED9B9",
    desc: "Scans DeFi protocols for yield opportunities. Analyzes APY, TVL, liquidity, and risk scores across Aave, Curve, Compound.",
  },
  {
    name: "STRATEGIST",
    role: "Portfolio Optimization",
    color: "#D53E0F",
    desc: "Ranks opportunities, sizes positions, and constructs optimal portfolios. Balances risk vs reward using on-chain data.",
  },
  {
    name: "GUARDIAN",
    role: "Risk Enforcement",
    color: "#9B0F06",
    desc: "The veto power. Checks every trade against risk parameters. Can block trades that exceed volatility, drawdown, or reputation thresholds.",
  },
  {
    name: "EXECUTOR",
    role: "Trade Execution",
    color: "#D53E0F",
    desc: "Executes approved trades on-chain. Records P&L, updates vault balance, and reports results back to the system.",
  },
];

export default function AgentsShowcase() {
  return (
    <section style={{ padding: "var(--space-40) 40px", maxWidth: 1400, margin: "0 auto" }}>
      <RevealText>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(32px, 5vw, 64px)",
            letterSpacing: 3,
            lineHeight: 1,
            marginBottom: 64,
          }}
        >
          THE 4 AGENTS
        </h2>
      </RevealText>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 24 }}>
        {agents.map((agent, i) => (
          <TiltCard key={agent.name} agent={agent} delay={i * 100} />
        ))}
      </div>

      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

function TiltCard({ agent, delay }: { agent: (typeof agents)[number]; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("");

  const handleMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTransform(`perspective(600px) rotateX(${-y * 8}deg) rotateY(${x * 8}deg)`);
  };

  const handleLeave = () => setTransform("");

  return (
    <RevealText delay={delay}>
      <div
        ref={ref}
        data-interactive
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        style={{
          padding: 32,
          background: "linear-gradient(135deg, rgba(213, 62, 15, 0.12), rgba(94, 0, 6, 0.06))",
          border: "1px solid rgba(213, 62, 15, 0.25)",
          borderLeft: `3px solid ${agent.color}`,
          transition: "transform 100ms linear",
          transform,
          minHeight: 200,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 3, color: agent.color, marginBottom: 8 }}>
            {agent.role}
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 36, letterSpacing: 3, lineHeight: 1, marginBottom: 16 }}>
            {agent.name}
          </div>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.6, color: "var(--muted)" }}>{agent.desc}</p>
        </div>
      </div>
    </RevealText>
  );
}
