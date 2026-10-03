"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeToChannel, type ConnectionStatus } from "@/lib/realtime-client";

/**
 * Subscribes to a realtime broadcast channel for the component's lifetime.
 * `onReconnect` fires when the connection comes back after a drop, so callers can refetch.
 */
export function useRealtimeChannel<Events extends object>(
  channel: string | null,
  handlers: { [E in keyof Events]?: (payload: Events[E]) => void },
  onReconnect?: () => void,
): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const handlersRef = useRef(handlers);
  const reconnectRef = useRef(onReconnect);
  useEffect(() => {
    handlersRef.current = handlers;
    reconnectRef.current = onReconnect;
  });

  useEffect(() => {
    if (!channel) return;
    let wasDisconnected = false;
    const proxies = {} as { [E in keyof Events]?: (payload: Events[E]) => void };
    for (const event of Object.keys(handlersRef.current) as (keyof Events)[]) {
      proxies[event] = (payload) => handlersRef.current[event]?.(payload);
    }
    const onStatus = (next: ConnectionStatus) => {
      setStatus(next);
      if (next === "disconnected") wasDisconnected = true;
      if (next === "connected" && wasDisconnected) {
        wasDisconnected = false;
        reconnectRef.current?.();
      }
    };
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = subscribeToChannel<Events>(channel, proxies, onStatus);
    } catch (err) {
      // Realtime misconfigured: the page still works through polling.
      console.error("Realtime unavailable", err);
      onStatus("disconnected");
    }
    return () => unsubscribe?.();
  }, [channel]);

  return status;
}

/** Calls `callback` every `ms` milliseconds while `enabled`. */
export function useInterval(callback: () => void, ms: number, enabled = true) {
  const ref = useRef(callback);
  useEffect(() => {
    ref.current = callback;
  });
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
}

/** A cooldown timer: `start(seconds)` begins it; returns whole seconds remaining. */
export function useCooldown(): [number, (seconds: number) => void] {
  const [remaining, setRemaining] = useState(0);
  const untilRef = useRef(0);
  const active = remaining > 0;

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((untilRef.current - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [active]);

  const start = useCallback((seconds: number) => {
    untilRef.current = Date.now() + seconds * 1000;
    setRemaining(seconds);
  }, []);
  return [remaining, start];
}
