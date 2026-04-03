"use client";
import Topbar from "@/components/dashboard/Topbar";
export default function SettingsPage() {
  return (
    <>
      <Topbar title="Settings" connected />
      <main style={{ padding: 32 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
          Configuration — Phase 3 implementation.
        </p>
      </main>
    </>
  );
}
