"use client";
import Topbar from "@/components/dashboard/Topbar";
export default function AgentsPage() {
  return (
    <>
      <Topbar title="Agents" connected />
      <main style={{ padding: 32 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
          Agent registry — Phase 2 implementation.
        </p>
      </main>
    </>
  );
}
