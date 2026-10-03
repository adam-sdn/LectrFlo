import "server-only";
import { ApiError } from "@/lib/api";

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io";

export function voiceConfig() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!apiKey || !agentId) return null;
  return { apiKey, agentId, baseUrl: process.env.ELEVENLABS_API_BASE_URL || ELEVENLABS_BASE_URL };
}

/** Short-lived signed WebSocket URL for one private agent conversation; the API key never leaves the server. */
export async function createSignedUrl(config: NonNullable<ReturnType<typeof voiceConfig>>): Promise<string> {
  let res: Response;
  try {
    res = await fetch(
      `${config.baseUrl}/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(config.agentId)}`,
      { headers: { "xi-api-key": config.apiKey }, signal: AbortSignal.timeout(10_000), cache: "no-store" },
    );
  } catch (err) {
    console.error("ElevenLabs signed URL request failed", err);
    throw new ApiError(502, "voice_failed", "The voice tutor couldn't start. Try again.");
  }
  if (!res.ok) {
    console.error(`ElevenLabs signed URL request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    throw new ApiError(502, "voice_failed", "The voice tutor couldn't start. Try again.");
  }
  const data = (await res.json()) as { signed_url?: string };
  if (!data.signed_url) throw new ApiError(502, "voice_failed", "The voice tutor couldn't start. Try again.");
  return data.signed_url;
}
