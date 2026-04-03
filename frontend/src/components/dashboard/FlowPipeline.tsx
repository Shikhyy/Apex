"use client";

import type { AgentName } from "@/lib/types";

interface FlowPipelineProps {
  activeNode: AgentName | null;
  decision: { approved: boolean } | null;
}

const nodes: { name: AgentName; label: string; color: string }[] = [
  { name: "scout", label: "SCOUT", color: "var(--blue)" },
  { name: "strategist", label: "STRATEGIST", color: "var(--purple)" },
  { name: "guardian", label: "GUARDIAN", color: "var(--gold)" },
  { name: "executor", label: "EXECUTOR", color: "var(--green)" },
];

export default function FlowPipeline({ activeNode, decision }: FlowPipelineProps) {
  const vetoed = decision && !decision.approved;

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, flexWrap: "wrap" }}>
        {nodes.map((node, i) => (
          <div key={node.name} style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: 80,
                height: 80,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                border: `2px solid ${activeNode === node.name ? node.color : "var(--dim)"}`,
                background: activeNode === node.name ? `${node.color}11` : "var(--deep)",
                boxShadow: activeNode === node.name ? `0 0 20px ${node.color}33` : "none",
                transition: "all var(--base) var(--ease-out)",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "999px",
                  background: activeNode === node.name ? node.color : "var(--dim)",
                  animation: activeNode === node.name ? "pulse 1.5s infinite" : "none",
                  marginBottom: 8,
                }}
              />
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: 2,
                  color: activeNode === node.name ? node.color : "var(--muted)",
                }}
              >
                {node.label}
              </div>
            </div>

            {i < nodes.length - 1 && (
              <div
                style={{
                  width: 60,
                  height: 2,
                  background: "var(--dim)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: "100%",
                    background: activeNode === nodes[i + 1].name ? nodes[i + 1].color : "var(--amber)",
                    animation: activeNode === nodes[i + 1].name ? "shimmer 1s linear infinite" : "none",
                    backgroundSize: "200% 100%",
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Veto branch */}
      {vetoed && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 2,
                height: 24,
                background: "var(--red)",
                borderLeft: "2px dotted var(--red)",
              }}
            />
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: 2,
                color: "var(--red)",
                padding: "4px 12px",
                border: "1px solid var(--red)",
              }}
            >
              VETO
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
