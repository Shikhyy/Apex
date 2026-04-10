"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Monitor", icon: "◉" },
  { href: "/dashboard/agents", label: "Agents", icon: "⬡" },
  { href: "/dashboard/veto-log", label: "Veto", icon: "⊘" },
  { href: "/dashboard/portfolio", label: "Portfolio", icon: "◈" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙" },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        display: "none",
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "linear-gradient(180deg, rgba(13, 13, 13, 0.98), rgba(94, 0, 6, 0.22))",
        borderTop: "1px solid rgba(213, 62, 15, 0.25)",
        zIndex: 100,
        padding: "8px 0 env(safe-area-inset-bottom, 8px)",
      }}
      className="mobile-bottom-nav"
    >
      <div style={{ display: "flex", justifyContent: "space-around" }}>
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-interactive
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                padding: "8px 12px",
                color: active ? "var(--apex-burn)" : "var(--muted)",
                transition: "color var(--fast)",
              }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: 1 }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
