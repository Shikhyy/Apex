"use client";

import type { AgentName } from "@/lib/types";

interface FlowPipelineProps {
  activeNode: AgentName | null;
  decision: { approved: boolean } | null;
  cycleStatus?: "idle" | "running" | "complete";
}

const nodes: {
  name: AgentName;
  label: string;
  role: string;
  color: string;
  icon: string;
}[] = [
  { name: "scout", label: "SCOUT", role: "Market Intel", color: "#60a5fa", icon: "◎" },
  { name: "strategist", label: "STRATEGIST", role: "Intent Gen", color: "#c084fc", icon: "◈" },
  { name: "guardian", label: "GUARDIAN", role: "Risk Guard", color: "#fbbf24", icon: "⬡" },
  { name: "executor", label: "EXECUTOR", role: "On-Chain Exec", color: "#34d399", icon: "◆" },
];

const nodeOrder: AgentName[] = ["scout", "strategist", "guardian", "executor"];

function getNodeState(
  name: AgentName,
  activeNode: AgentName | null,
  decision: { approved: boolean } | null,
  cycleStatus?: string
): "idle" | "active" | "complete" | "vetoed" {
  const activeIdx = activeNode ? nodeOrder.indexOf(activeNode) : -1;
  const nodeIdx = nodeOrder.indexOf(name);

  if (activeNode === name) return "active";
  if (cycleStatus === "complete") {
    if (decision && !decision.approved && name === "executor") return "vetoed";
    if (nodeIdx < activeIdx || (activeIdx === -1 && cycleStatus === "complete")) return "complete";
  }
  if (activeIdx > nodeIdx) return "complete";

  return "idle";
}

export default function FlowPipeline({
  activeNode,
  decision,
  cycleStatus,
}: FlowPipelineProps) {
  const vetoed = decision && !decision.approved;
  const activeIdx = activeNode ? nodeOrder.indexOf(activeNode) : -1;

  return (
    <div
      style={{
        padding: "28px 32px",
        background: "linear-gradient(180deg, rgba(13,13,13,0.9) 0%, rgba(10,10,10,0.6) 100%)",
        borderBottom: "1px solid #1e1e1e",
      }}
    >
      {/* Phase label */}
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: 3,
          color: "#444",
          textTransform: "uppercase",
          marginBottom: 20,
          textAlign: "center",
        }}
      >
        {activeNode
          ? `Agent Pipeline — ${activeNode.toUpperCase()} Processing`
          : cycleStatus === "complete"
          ? "Cycle Complete"
          : "Agent Pipeline — Standby"}
      </div>

      {/* Node row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          flexWrap: "nowrap",
          overflowX: "auto",
        }}
      >
        {nodes.map((node, i) => {
          const nodeState = getNodeState(node.name, activeNode, decision, cycleStatus);
          const isActive = nodeState === "active";
          const isComplete = nodeState === "complete";
          const isVetoed = nodeState === "vetoed";

          const borderColor = isActive
            ? node.color
            : isComplete
            ? `${node.color}88`
            : isVetoed
            ? "#f87171"
            : "#1e1e1e";

          const bgColor = isActive
            ? `${node.color}18`
            : isComplete
            ? `${node.color}08`
            : "#0d0d0d";

          const textColor = isActive
            ? node.color
            : isComplete
            ? `${node.color}99`
            : "#333";

          return (
            <div key={node.name} style={{ display: "flex", alignItems: "center" }}>
              {/* Node box */}
              <div
                style={{
                  width: 100,
                  minWidth: 100,
                  padding: "14px 8px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `1px solid ${borderColor}`,
                  background: bgColor,
                  boxShadow: isActive
                    ? `0 0 24px ${node.color}33, inset 0 0 12px ${node.color}11`
                    : "none",
                  transition: "all 400ms cubic-bezier(0.16, 1, 0.3, 1)",
                  position: "relative",
                  cursor: "default",
                }}
              >
                {/* Status dot */}
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "999px",
                    background: isActive ? node.color : isComplete ? `${node.color}66` : "#222",
                    animation: isActive ? "pulse 1.2s ease-in-out infinite" : "none",
                    marginBottom: 8,
                  }}
                />

                {/* Icon */}
                <div
                  style={{
                    fontSize: 18,
                    color: textColor,
                    marginBottom: 6,
                    lineHeight: 1,
                  }}
                >
                  {node.icon}
                </div>

                {/* Label */}
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 8,
                    letterSpacing: 2,
                    color: textColor,
                    fontWeight: isActive ? 700 : 400,
                  }}
                >
                  {node.label}
                </div>

                {/* Role */}
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 7,
                    color: "#333",
                    marginTop: 3,
                    letterSpacing: 0.5,
                  }}
                >
                  {node.role}
                </div>

                {/* Active glow ring */}
                {isActive && (
                  <div
                    style={{
                      position: "absolute",
                      inset: -1,
                      border: `1px solid ${node.color}`,
                      pointerEvents: "none",
                      animation: "pulse 1.8s ease-in-out infinite",
                    }}
                  />
                )}
              </div>

              {/* Connector arrow between nodes */}
              {i < nodes.length - 1 && (
                <div
                  style={{
                    width: 48,
                    height: 2,
                    position: "relative",
                    flexShrink: 0,
                    overflow: "hidden",
                  }}
                >
                  {/* Base line */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "#1a1a1a",
                    }}
                  />
                  {/* Progress fill */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width:
                        activeIdx > i
                          ? "100%"
                          : activeIdx === i + 1
                          ? "60%"
                          : "0%",
                      background: nodes[i + 1].color,
                      transition: "width 600ms cubic-bezier(0.16, 1, 0.3, 1)",
                      boxShadow: activeIdx === i + 1
                        ? `0 0 8px ${nodes[i + 1].color}`
                        : "none",
                    }}
                  />
                  {/* Arrow tip */}
                  <div
                    style={{
                      position: "absolute",
                      right: -4,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 0,
                      height: 0,
                      borderTop: "4px solid transparent",
                      borderBottom: "4px solid transparent",
                      borderLeft: `5px solid ${activeIdx >= i + 1 ? nodes[i + 1].color : "#1a1a1a"}`,
                      transition: "border-left-color 600ms",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Veto branch indicator */}
      {vetoed && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 20,
            animation: "vetoFlash 400ms var(--ease-out)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 20px",
              background: "#f8717115",
              border: "1px solid #f87171",
              borderTop: "none",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: 3,
              color: "#f87171",
            }}
          >
            <span>⊘</span>
            <span>TRADE VETOED — CAPITAL PROTECTED</span>
          </div>
        </div>
      )}

      {/* Approved indicator */}
      {decision && decision.approved && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 20,
            animation: "fadeIn 400ms var(--ease-out)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 20px",
              background: "#34d39915",
              border: "1px solid #34d399",
              borderTop: "none",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: 3,
              color: "#34d399",
            }}
          >
            <span>✓</span>
            <span>TRADE APPROVED — EXECUTING ON-CHAIN</span>
          </div>
        </div>
      )}
    </div>
  );
}
