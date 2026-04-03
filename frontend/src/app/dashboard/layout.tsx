"use client";

import Sidebar from "@/components/dashboard/Sidebar";
import Cursor from "@/components/ui/Cursor";
import Noise from "@/components/ui/Noise";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--void)" }}>
      <Cursor />
      <Noise />
      <Sidebar />
      <div style={{ flex: 1, overflow: "auto" }}>{children}</div>
    </div>
  );
}
