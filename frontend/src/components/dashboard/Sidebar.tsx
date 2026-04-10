"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/shared/Logo";

const navItems = [
  { href: "/dashboard", label: "Cycle Monitor", icon: "◉" },
  { href: "/dashboard/agents", label: "Agents", icon: "⬡" },
  { href: "/dashboard/veto-log", label: "Veto Log", icon: "⊘" },
  { href: "/dashboard/portfolio", label: "Portfolio", icon: "◈" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="sidebar"
      style={{
        width: 220,
        height: "100vh",
        position: "sticky",
        top: 0,
        background: "linear-gradient(180deg, rgba(13, 13, 13, 0.96), rgba(94, 0, 6, 0.2))",
        borderRight: "1px solid rgba(213, 62, 15, 0.25)",
        display: "flex",
        flexDirection: "column",
        padding: "24px 0",
        flexShrink: 0,
      }}
    >
      <div style={{ padding: "0 20px", marginBottom: 40 }}>
        <Logo variant="full" />
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-interactive
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 20px",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: 1,
                color: active ? "var(--apex-burn)" : "var(--muted)",
                borderLeft: active ? "3px solid var(--apex-burn)" : "3px solid transparent",
                background: active ? "rgba(213, 62, 15, 0.12)" : "transparent",
                transition: "all var(--fast) var(--ease-out)",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.color = "var(--apex-cream)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.color = "var(--muted)";
              }}
            >
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: "auto", padding: "20px" }}>
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: 1,
            color: "var(--muted)",
          }}
        >
          ← Back to Home
        </Link>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .sidebar { width: 48px !important; }
          .sidebar-label { display: none !important; }
          .sidebar nav a { justify-content: center; padding: 12px 0; }
        }
      `}</style>
    </aside>
  );
}
