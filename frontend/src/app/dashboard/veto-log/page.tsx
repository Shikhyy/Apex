"use client";
import Topbar from "@/components/dashboard/Topbar";
export default function VetoLogPage() {
  return (
    <>
      <Topbar title="Veto Log" connected />
      <main style={{ padding: 32 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
          Veto history — Phase 2 implementation.
        </p>
      </main>
    </>
  );
}
