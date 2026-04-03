"use client";
import Topbar from "@/components/dashboard/Topbar";
export default function PortfolioPage() {
  return (
    <>
      <Topbar title="Portfolio" connected />
      <main style={{ padding: 32 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
          Portfolio & yield — Phase 3 implementation.
        </p>
      </main>
    </>
  );
}
