"use client";

import Sidebar from "@/components/dashboard/Sidebar";
import MobileBottomNav from "@/components/dashboard/MobileBottomNav";
import Cursor from "@/components/ui/Cursor";
import Noise from "@/components/ui/Noise";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

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
      <ErrorBoundary>
        <div style={{ flex: 1, overflow: "auto", paddingBottom: 60 }}>
          {/* Mobile warning */}
          <div
            style={{
              display: "none",
              padding: "12px 20px",
              background: "#f59e0b15",
              border: "1px solid var(--gold)",
              borderBottom: "1px solid var(--dim)",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: 1,
              color: "var(--gold)",
            }}
            className="mobile-warning"
          >
            ⚠ Use desktop for the full APEX experience
          </div>
          {children}
        </div>
      </ErrorBoundary>
      <MobileBottomNav />
      <style>{`
        @media (max-width: 768px) {
          .mobile-warning { display: block !important; }
        }
      `}</style>
    </div>
  );
}
