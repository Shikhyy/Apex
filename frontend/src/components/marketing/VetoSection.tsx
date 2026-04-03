import RevealText from "@/components/ui/RevealText";

export default function VetoSection() {
  return (
    <section style={{ background: "var(--white)", color: "var(--void)", padding: "var(--space-40) 40px" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <RevealText>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(48px, 8vw, 120px)",
              letterSpacing: 6,
              lineHeight: 0.9,
              marginBottom: 48,
              WebkitTextStroke: "2px var(--void)",
              color: "transparent",
            }}
          >
            THE VETO
          </h2>
        </RevealText>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80 }}>
          <RevealText delay={200}>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 18, lineHeight: 1.7, color: "var(--mid)" }}>
              The Guardian agent enforces risk parameters on every trade.
              If volatility spikes, drawdown limits are approached, or the
              Scout&apos;s reputation falls below threshold — the Guardian vetoes.
            </p>
          </RevealText>

          <RevealText delay={400}>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 18, lineHeight: 1.7, color: "var(--mid)" }}>
              Every veto is recorded on-chain via ERC-8004. The Guardian
              earns reputation for knowing when NOT to trade. This is the
              core insight: restraint is a form of intelligence.
            </p>
          </RevealText>
        </div>

        <RevealText delay={600}>
          <div style={{ marginTop: 64, padding: 32, border: "2px solid var(--void)", fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 2 }}>
            <div style={{ color: "var(--mid)" }}>
              <span style={{ color: "var(--void)" }}>reason:</span> volatility_spike
            </div>
            <div style={{ color: "var(--mid)" }}>
              <span style={{ color: "var(--void)" }}>confidence:</span> 0.94
            </div>
            <div style={{ color: "var(--mid)" }}>
              <span style={{ color: "var(--void)" }}>action:</span>{" "}
              <span style={{ color: "var(--red)", fontWeight: 700 }}>VETOED</span>
            </div>
            <div style={{ color: "var(--mid)" }}>
              <span style={{ color: "var(--void)" }}>on-chain:</span>{" "}
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
