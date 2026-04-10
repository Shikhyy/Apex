import RevealText from "@/components/ui/RevealText";

export default function VetoSection() {
  return (
    <section
      style={{
        background: "linear-gradient(180deg, rgba(94, 0, 6, 0.92), rgba(10, 10, 10, 0.95))",
        color: "var(--apex-cream)",
        padding: "var(--space-40) 40px",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <RevealText>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(48px, 8vw, 120px)",
              letterSpacing: 6,
              lineHeight: 0.9,
              marginBottom: 48,
              WebkitTextStroke: "2px var(--apex-cream)",
              color: "transparent",
            }}
          >
            THE VETO
          </h2>
        </RevealText>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80 }}>
          <RevealText delay={200}>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 18, lineHeight: 1.7, color: "rgba(238, 217, 185, 0.86)" }}>
              The Guardian agent enforces risk parameters on every trade.
              If volatility spikes, drawdown limits are approached, or the
              Scout&apos;s reputation falls below threshold — the Guardian vetoes.
            </p>
          </RevealText>

          <RevealText delay={400}>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 18, lineHeight: 1.7, color: "rgba(238, 217, 185, 0.86)" }}>
              Every veto is recorded on-chain via ERC-8004. The Guardian
              earns reputation for knowing when NOT to trade. This is the
              core insight: restraint is a form of intelligence.
            </p>
          </RevealText>
        </div>

        <RevealText delay={600}>
          <div
            style={{
              marginTop: 64,
              padding: 32,
              border: "1px solid rgba(238, 217, 185, 0.45)",
              background: "rgba(10, 10, 10, 0.25)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              lineHeight: 2,
            }}
          >
            <div style={{ color: "rgba(238, 217, 185, 0.72)" }}>
              <span style={{ color: "var(--apex-cream)" }}>reason:</span> volatility_spike
            </div>
            <div style={{ color: "rgba(238, 217, 185, 0.72)" }}>
              <span style={{ color: "var(--apex-cream)" }}>confidence:</span> 0.94
            </div>
            <div style={{ color: "rgba(238, 217, 185, 0.72)" }}>
              <span style={{ color: "var(--apex-cream)" }}>action:</span>{" "}
              <span style={{ color: "var(--apex-burn)", fontWeight: 700 }}>VETOED</span>
            </div>
            <div style={{ color: "rgba(238, 217, 185, 0.72)" }}>
              <span style={{ color: "var(--apex-cream)" }}>on-chain:</span>{" "}
              <span style={{ textDecoration: "underline" }}>0x8f3a...c72d</span>
            </div>
          </div>
        </RevealText>
      </div>

      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; gap: 32px !important; }
        }
      `}</style>
    </section>
  );
}
