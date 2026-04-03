import { useState, useCallback, useRef } from "react";
import { triggerCycle as apiTriggerCycle } from "@/lib/api";
import type { CycleState } from "@/lib/types";

const initialState: CycleState = {
  status: "idle",
  cycleNumber: 0,
  activeNode: null,
  decision: null,
  txHash: null,
  sessionPnl: 0,
  vetoCount: 0,
  approvalCount: 0,
};

export function useCycle() {
  const [state, setState] = useState<CycleState>(initialState);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerCycle = useCallback(async () => {
    try {
      setState((s) => ({ ...s, status: "running", activeNode: "scout" }));
      await apiTriggerCycle();
    } catch {
      setState((s) => ({ ...s, status: "idle", activeNode: null }));
    }
  }, []);

  const updateFromSSE = useCallback((type: string, data: Record<string, unknown>) => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }

    setState((s) => {
      const next = { ...s };

      switch (type) {
        case "scout":
          next.activeNode = "scout";
          break;
        case "strategist":
          next.activeNode = "strategist";
          break;
        case "guardian": {
          next.activeNode = "guardian";
          const decision = data as Record<string, unknown>;
          if (decision.guardian_decision !== undefined) {
            const approved = decision.guardian_decision === "approved";
            next.decision = {
              approved,
              reason: (decision.guardian_reason as string) || "",
              confidence: Number(decision.guardian_confidence || 0),
              detail: (decision.guardian_detail as string) || "",
              txHash: decision.tx_hash as string | undefined,
            };
            if (!approved) {
              next.vetoCount = s.vetoCount + 1;
            } else {
              next.approvalCount = s.approvalCount + 1;
            }
          }
          break;
        }
        case "executor":
          next.activeNode = "executor";
          if (data.tx_hash) next.txHash = data.tx_hash as string;
          break;
        case "veto":
          next.vetoCount = s.vetoCount + 1;
          break;
        case "done":
          next.status = "complete";
          next.activeNode = null;
          if (data.session_pnl !== undefined) next.sessionPnl = Number(data.session_pnl);
          if (data.cycle_number !== undefined) next.cycleNumber = Number(data.cycle_number);
          dismissTimer.current = setTimeout(() => {
            setState((prev) => ({ ...prev, decision: null }));
          }, 8000);
          break;
      }

      return next;
    });
  }, []);

  return { state, triggerCycle, updateFromSSE };
}
