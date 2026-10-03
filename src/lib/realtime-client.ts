"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { browserClient } from "@/lib/supabase/browser";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

/**
 * Subscribes to a broadcast channel (see "@/lib/realtime" for channel names and
 * event payloads). Returns an unsubscribe function. On "connected" after a drop,
 * callers should refetch state since events may have been missed.
 */
export function subscribeToChannel<Events extends object>(
  channel: string,
  handlers: { [E in keyof Events]?: (payload: Events[E]) => void },
  onStatus?: (status: ConnectionStatus) => void,
): () => void {
  const supabase = browserClient();
  onStatus?.("connecting");
  const ch: RealtimeChannel = supabase.channel(channel);
  for (const event of Object.keys(handlers) as (keyof Events & string)[]) {
    ch.on("broadcast", { event }, (message) => handlers[event]?.(message.payload as Events[typeof event]));
  }
  ch.subscribe((status) => {
    if (status === "SUBSCRIBED") onStatus?.("connected");
    else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") onStatus?.("disconnected");
  });
  return () => {
    void supabase.removeChannel(ch);
  };
}
