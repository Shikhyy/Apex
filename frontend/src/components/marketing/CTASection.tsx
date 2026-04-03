import Link from "next/link";
import RevealText from "@/components/ui/RevealText";

export default function CTASection() {
  return (
    <section style={{ padding: "var(--space-40) 40px", textAlign: "center", borderTop: "1px solid var(--dim)" }}>
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
          READY TO <span style={{ color: "var(--amber)" }}>OPTIMIZE</span>
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
            background: "var(--amber)",
            color: "var(--void)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: 3,
            textTransform: "uppercase",
            fontWeight: 700,
            transition: "all var(--fast) var(--ease-out)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 32px #e8ff0033";
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
