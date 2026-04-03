import RevealText from "@/components/ui/RevealText";

const steps = [
  { text: "Scout → Finds opportunities", color: "var(--blue)" },
  { text: "Strategist → Ranks & sizes", color: "var(--purple)" },
  { text: "Guardian → Approves or vetoes", color: "var(--gold)" },
  { text: "Executor → Deploys capital", color: "var(--green)" },
];

export default function WhatSection() {
  return (
    <section
      style={{
        padding: "var(--space-40) 40px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 80,
        maxWidth: 1400,
        margin: "0 auto",
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
              marginBottom: 24,
            }}
          >
            WHAT IS APEX
          </h2>
        </RevealText>
        <RevealText delay={200}>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 16,
              lineHeight: 1.7,
              color: "var(--muted)",
              maxWidth: 480,
            }}
          >
            APEX is a multi-agent DeFi yield optimizer built on ERC-8004.
            Four specialized agents — Scout, Strategist, Guardian, and Executor —
            work in sequence to find, evaluate, approve, and execute yield strategies.
          </p>
        </RevealText>
        <RevealText delay={400}>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 16,
              lineHeight: 1.7,
              color: "var(--muted)",
              maxWidth: 480,
              marginTop: 16,
            }}
          >
            Every decision is recorded on-chain. Every agent earns a reputation
            score. The Guardian can veto any trade that violates risk parameters.
          </p>
        </RevealText>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center" }}>
        {steps.map((step, i) => (
          <RevealText key={step.text} delay={i * 150}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                color: "var(--white)",
                padding: "16px 20px",
                borderLeft: `3px solid ${step.color}`,
                background: "var(--deep)",
              }}
            >
              {step.text}
            </div>
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
