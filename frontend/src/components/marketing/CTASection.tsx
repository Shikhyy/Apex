import Link from "next/link";
import RevealText from "@/components/ui/RevealText";

export default function CTASection() {
  return (
    <section
      style={{
        padding: "var(--space-40) 40px",
        textAlign: "center",
        borderTop: "1px solid rgba(213, 62, 15, 0.25)",
        background: "linear-gradient(180deg, rgba(10, 10, 10, 0.45), rgba(94, 0, 6, 0.2))",
      }}
    >
      <RevealText>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(32px, 6vw, 80px)",
            letterSpacing: 4,
            lineHeight: 1,
            marginBottom: 16,
          }}
        >
          READY TO <span style={{ color: "var(--apex-burn)" }}>OPTIMIZE</span>
        </h2>
      </RevealText>

      <RevealText delay={200}>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 16, color: "var(--muted)", marginBottom: 48 }}>
          Launch the dashboard and watch APEX in action.
        </p>
      </RevealText>

      <RevealText delay={400}>
        <Link
          href="/dashboard"
          data-interactive
          style={{
            display: "inline-block",
            padding: "20px 60px",
            background: "linear-gradient(135deg, #D53E0F, #9B0F06)",
            color: "var(--apex-cream)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: 3,
            textTransform: "uppercase",
            fontWeight: 700,
            transition: "all var(--fast) var(--ease-out)",
            border: "1px solid rgba(238, 217, 185, 0.35)",
            borderRadius: 8,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 10px 34px rgba(213, 62, 15, 0.45)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          Launch Dashboard
        </Link>
      </RevealText>
    </section>
  );
}
