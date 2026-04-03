"use client";

import { useState } from "react";
import Topbar from "@/components/dashboard/Topbar";

export default function DashboardPage() {
  const [connected] = useState(true);

  return (
    <>
      <Topbar title="Cycle Monitor" connected={connected} />
      <main style={{ padding: 32 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
          Live cycle monitor — Phase 2 implementation.
        </p>
      </main>
    </>
  );
}
