import RevealText from "@/components/ui/RevealText";

const stats = [
  { label: "Agents", value: "4" },
  { label: "Protocols", value: "12+" },
  { label: "On-Chain", value: "ERC-8004" },
  { label: "Network", value: "Base" },
];

const tech = ["Next.js 15", "React 19", "TypeScript", "viem", "wagmi", "Recharts", "FastAPI", "Groq LLM", "Foundry", "IPFS"];

export default function StackSection() {
  return (
    <section
      style={{
        padding: "var(--space-40) 40px",
        maxWidth: 1400,
        margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 80,
      }}
    >
      <div>
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
            TECH STACK
          </h2>
        </RevealText>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {stats.map((s) => (
            <RevealText key={s.label} delay={100}>
              <div style={{ padding: 24, background: "var(--deep)", border: "1px solid var(--dim)" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 40, letterSpacing: 2, color: "var(--amber)", lineHeight: 1 }}>
                  {s.value}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: 2,
                    color: "var(--muted)",
                    marginTop: 8,
                    textTransform: "uppercase",
                  }}
                >
                  {s.label}
                </div>
              </div>
            </RevealText>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignContent: "center" }}>
        {tech.map((t, i) => (
          <RevealText key={t} delay={i * 50}>
            <span
              style={{
                display: "inline-block",
                padding: "8px 16px",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                letterSpacing: 1,
                border: "1px solid var(--dim)",
                color: "var(--muted)",
                transition: "all var(--fast) var(--ease-out)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--amber)";
                e.currentTarget.style.color = "var(--amber)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--dim)";
                e.currentTarget.style.color = "var(--muted)";
              }}
            >
              {t}
            </span>
          </RevealText>
        ))}
      </div>

      <style>{`
        @media (max-width: 768px) {
          section { grid-template-columns: 1fr !important; gap: 40px !important; }
        }
      `}</style>
    </section>
  );
}
