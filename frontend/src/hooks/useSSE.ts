import { useEffect, useState, useCallback } from "react";
import type { SSEEvent } from "@/lib/types";

const MAX_EVENTS = 100;

let singleton: {
  es: EventSource | null;
  listeners: Set<() => void>;
  events: SSEEvent[];
  connected: boolean;
  url: string | null;
} | null = null;

function connectSSE(url: string) {
  if (!singleton) return;

  const es = new EventSource(url);
  singleton.es = es;
  singleton.url = url;

  es.onopen = () => {
    if (singleton) {
      singleton.connected = true;
      singleton.listeners.forEach((fn) => fn());
    }
  };

  es.onerror = () => {
    if (!singleton) return;
    singleton.connected = false;
    singleton.es = null;
    singleton.listeners.forEach((fn) => fn());
    // Reconnect after 3s if there are still listeners
    setTimeout(() => {
      if (singleton && singleton.listeners.size > 0 && singleton.url) {
        connectSSE(singleton.url);
      }
    }, 3000);
  };

  const types: SSEEvent["type"][] = [
    "scout",
    "strategist",
    "guardian",
    "executor",
    "veto",
    "done",
  ];

  types.forEach((type) => {
    es.addEventListener(type, (e: MessageEvent) => {
      if (!singleton) return;
      const raw = JSON.parse((e as MessageEvent).data);
      // Backend sends { node, timestamp, data: {...} }
      const event: SSEEvent = {
        type,
        timestamp: raw.timestamp || new Date().toISOString(),
        data: raw.data !== undefined ? raw.data : raw,
      };
      singleton.events = [...singleton.events, event].slice(-MAX_EVENTS);
      singleton.listeners.forEach((fn) => fn());
    });
  });
}

export function useSSE(url: string) {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [connected, setConnected] = useState(false);

  const notify = useCallback(() => {
    if (singleton) {
      setEvents([...singleton.events]);
      setConnected(singleton.connected);
    }
  }, []);

  useEffect(() => {
    if (!singleton) {
      singleton = {
        es: null,
        listeners: new Set(),
        events: [],
        connected: false,
        url: null,
      };
    }
    singleton.listeners.add(notify);

    // Immediately sync current state (don't clear existing events)
    setEvents([...singleton.events]);
    setConnected(singleton.connected);

    // Only start connection if not already running
    if (!singleton.es) {
      connectSSE(url);
    }

    return () => {
      if (singleton) {
        singleton.listeners.delete(notify);
        if (singleton.listeners.size === 0) {
          singleton.es?.close();
          singleton = null;
        }
      }
    };
  }, [url, notify]);

  return { events, connected };
}
