"use client";

import Link from "next/link";

interface LogoProps {
  variant?: "full" | "icon";
  light?: boolean;
}

export default function Logo({ variant = "full", light = false }: LogoProps) {
  const textColor = light ? "var(--void)" : "var(--white)";
  const iconBg = light ? "var(--void)" : "#0a0a0a";
  const boltColor = light ? "var(--amber)" : "var(--amber)";

  if (variant === "icon") {
    return (
      <Link href="/" aria-label="APEX Home">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="4" fill={iconBg} />
          <path d="M18 4L8 24h4l2-6h6l2 6h4L18 4zm0 8l-3 8h6l-3-8z" fill={boltColor} />
        </svg>
      </Link>
    );
  }

  return (
    <Link href="/" aria-label="APEX Home" style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
        <rect width="32" height="32" rx="4" fill={iconBg} />
        <path d="M18 4L8 24h4l2-6h6l2 6h4L18 4zm0 8l-3 8h6l-3-8z" fill={boltColor} />
      </svg>
      <div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 24,
            letterSpacing: 4,
            color: textColor,
            lineHeight: 1,
          }}
        >
          APEX
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 8,
            letterSpacing: 2,
            color: light ? "var(--mid)" : "var(--muted)",
            lineHeight: 1,
          }}
        >
          YIELD OPTIMIZER
        </div>
      </div>
    </Link>
  );
}
