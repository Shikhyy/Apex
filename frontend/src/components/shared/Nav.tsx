"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";

const links = [
  { href: "/", label: "Home" },
  { href: "/docs", label: "Docs" },
  { href: "/dashboard", label: "Dashboard" },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isVeto = pathname === "/veto";

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 40px",
        background: isVeto ? "var(--white)" : "transparent",
        backdropFilter: !isVeto ? "blur(12px)" : "none",
        borderBottom: `1px solid ${isVeto ? "var(--dim)" : "transparent"}`,
        transition: "all var(--base) var(--ease-out)",
      }}
    >
      <Logo light={isVeto} />

      <div className="nav-links-desktop" style={{ display: "flex", gap: 32, alignItems: "center" }}>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: pathname === l.href ? "var(--amber)" : isVeto ? "var(--void)" : "var(--muted)",
              transition: "color var(--fast) var(--ease-out)",
            }}
          >
            {l.label}
          </Link>
        ))}
      </div>

      <button
        onClick={() => setOpen(!open)}
        className="nav-hamburger"
        style={{ display: "none" }}
        aria-label="Toggle menu"
        aria-expanded={open}
      >
        <div style={{ width: 24, display: "flex", flexDirection: "column", gap: 5 }}>
          <span
            style={{
              display: "block",
              height: 2,
              background: isVeto ? "var(--void)" : "var(--white)",
              transition: "all var(--fast)",
              transform: open ? "rotate(45deg) translate(5px, 5px)" : "none",
            }}
          />
          <span
            style={{
              display: "block",
              height: 2,
              background: isVeto ? "var(--void)" : "var(--white)",
              transition: "all var(--fast)",
              opacity: open ? 0 : 1,
            }}
          />
          <span
            style={{
              display: "block",
              height: 2,
              background: isVeto ? "var(--void)" : "var(--white)",
              transition: "all var(--fast)",
              transform: open ? "rotate(-45deg) translate(5px, -5px)" : "none",
            }}
          />
        </div>
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            top: 72,
            left: 0,
            right: 0,
            bottom: 0,
            background: "var(--void)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 32,
            zIndex: 99,
          }}
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 48,
                letterSpacing: 4,
                color: pathname === l.href ? "var(--amber)" : "var(--white)",
              }}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .nav-links-desktop { display: none !important; }
          .nav-hamburger { display: block !important; }
        }
      `}</style>
    </nav>
  );
}
