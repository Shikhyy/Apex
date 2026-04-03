"use client";

import Link from "next/link";

interface LogoProps {
  variant?: "full" | "icon";
  light?: boolean;
}

export default function Logo({ variant = "full", light = false }: LogoProps) {
  const textColor = light ? "var(--void)" : "var(--white)";
  const iconBg = light ? "var(--void)" : "var(--amber)";
  const iconColor = light ? "var(--amber)" : "var(--void)";

  if (variant === "icon") {
    return (
      <Link href="/" aria-label="APEX Home">
        <div
          style={{
            width: 32,
            height: 32,
            background: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={iconColor}>
            <path d="M13 2L3 22h4l2-6h6l2 6h4L13 2zm0 6l-3 8h6l-3-8z" />
          </svg>
        </div>
      </Link>
    );
  }

  return (
    <Link href="/" aria-label="APEX Home" style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 32,
          height: 32,
          background: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill={iconColor}>
          <path d="M13 2L3 22h4l2-6h6l2 6h4L13 2zm0 6l-3 8h6l-3-8z" />
        </svg>
      </div>
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
