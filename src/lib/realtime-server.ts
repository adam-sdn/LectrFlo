import "server-only";
import { publicSupabaseEnv, serviceRoleKey } from "@/lib/env";
import type { HostChannelEvents, LectureChannelEvents } from "@/lib/realtime";

async function send(topic: string, event: string, payload: unknown): Promise<void> {
  const key = serviceRoleKey();
  try {
    const res = await fetch(`${publicSupabaseEnv().url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ topic, event, payload, private: false }] }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error(`Realtime broadcast ${event} failed: ${res.status}`);
  } catch (err) {
    // Realtime is best-effort; clients recover by refetching state.
    console.error(`Realtime broadcast ${event} failed`, err);
  }
}

export function broadcastLecture<E extends keyof LectureChannelEvents>(
  channel: string,
  event: E,
  payload: LectureChannelEvents[E],
) {
  return send(channel, event, payload);
}

export function broadcastHost<E extends keyof HostChannelEvents>(
  channel: string,
  event: E,
  payload: HostChannelEvents[E],
) {
  return send(channel, event, payload);
}
