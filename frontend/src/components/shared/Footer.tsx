import Logo from "./Logo";

const externalLinks = [
  { href: "https://github.com", label: "GitHub" },
  { href: "https://sepolia.etherscan.io", label: "Etherscan" },
  { href: "https://lablab.ai", label: "lablab.ai" },
];

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid rgba(213, 62, 15, 0.25)",
        background: "linear-gradient(180deg, rgba(10, 10, 10, 0.5), rgba(20, 10, 10, 0.8))",
        padding: "40px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Logo variant="icon" />
      <div style={{ display: "flex", gap: 24 }}>
        {externalLinks.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: 1,
              color: "var(--muted)",
              transition: "color var(--fast) var(--ease-out)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--apex-burn)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
          >
            {l.label}
          </a>
        ))}
      </div>
    </footer>
  );
}
