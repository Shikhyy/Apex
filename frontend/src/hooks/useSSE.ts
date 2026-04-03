import { useEffect, useRef, useState, useCallback } from "react";
import type { SSEEvent } from "@/lib/types";

const MAX_EVENTS = 50;

let singleton: { es: EventSource | null; listeners: Set<() => void> } | null = null;

export function useSSE(url: string) {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventsRef = useRef<SSEEvent[]>([]);

  const notify = useCallback(() => {
    setEvents([...eventsRef.current]);
  }, []);

  useEffect(() => {
    if (!singleton) {
      singleton = { es: null, listeners: new Set() };
    }
    singleton.listeners.add(notify);

    if (!singleton.es) {
      const es = new EventSource(url);
      singleton.es = es;

      es.onopen = () => setConnected(true);
      es.onerror = () => {
        setConnected(false);
        setError(new Error("SSE connection lost"));
      };

      const types: SSEEvent["type"][] = ["scout", "strategist", "guardian", "executor", "veto", "done"];
      types.forEach((type) => {
        es.addEventListener(type, (e) => {
          const data = JSON.parse(e.data);
          const event: SSEEvent = { type, timestamp: new Date().toISOString(), data };
          eventsRef.current = [...eventsRef.current, event].slice(-MAX_EVENTS);
          singleton!.listeners.forEach((fn) => fn());
        });
      });
    }

    eventsRef.current = [];
    setEvents([]);

    return () => {
      singleton!.listeners.delete(notify);
      if (singleton!.listeners.size === 0) {
        singleton?.es?.close();
        singleton = null;
      }
    };
  }, [url, notify]);

  return { events, connected, error };
}
