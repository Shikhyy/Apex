import { useState, useEffect, useRef, useCallback } from "react";
import { getReputationSummary } from "@/lib/contracts";
import type { ReputationSummary } from "@/lib/types";

export function useReputation(agentId: bigint) {
  const [summary, setSummary] = useState<ReputationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cached = useRef<ReputationSummary | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getReputationSummary(agentId);
      cached.current = result;
      setSummary(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      if (cached.current) setSummary(cached.current);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { summary, loading, error, refetch: fetch };
}
