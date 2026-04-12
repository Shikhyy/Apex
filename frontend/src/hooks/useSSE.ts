import { useEffect, useState, useCallback } from "react";
import type { SSEEvent } from "@/lib/types";

const MAX_EVENTS = 40;
const BASE_RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 30000;

let singleton: {
  es: EventSource | null;
  listeners: Set<() => void>;
  events: SSEEvent[];
  connected: boolean;
  url: string | null;
  reconnectAttempts: number;
} | null = null;

function connectSSE(url: string) {
  if (!singleton) return;

  const es = new EventSource(url);
  singleton.es = es;
  singleton.url = url;

  es.onopen = () => {
    if (singleton) {
      singleton.connected = true;
      singleton.reconnectAttempts = 0;
      singleton.listeners.forEach((fn) => fn());
    }
  };

  es.onerror = () => {
    if (!singleton) return;
    singleton.connected = false;
    singleton.es = null;
    singleton.listeners.forEach((fn) => fn());
    // Reconnect with capped exponential backoff + jitter.
    const attempt = singleton.reconnectAttempts;
    singleton.reconnectAttempts += 1;
    const backoff = Math.min(
      MAX_RECONNECT_DELAY_MS,
      BASE_RECONNECT_DELAY_MS * Math.pow(2, attempt)
    );
    const jitter = Math.floor(Math.random() * 1000);
    setTimeout(() => {
      if (singleton && singleton.listeners.size > 0 && singleton.url) {
        connectSSE(singleton.url);
      }
    }, backoff + jitter);
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

export function useSSE(url: string | null) {
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
        reconnectAttempts: 0,
      };
    }
    singleton.listeners.add(notify);

    if (!url) {
      singleton.es?.close();
      singleton.es = null;
      singleton.url = null;
      singleton.connected = false;
      singleton.events = [];
      setEvents([]);
      setConnected(false);
    } else {
      // Immediately sync current state.
      setEvents([...singleton.events]);
      setConnected(singleton.connected);

      // Reconnect when URL changes (for wallet-specific streams).
      if (!singleton.es || singleton.url !== url) {
        singleton.es?.close();
        singleton.es = null;
        singleton.connected = false;
        singleton.events = [];
        connectSSE(url);
      }
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
