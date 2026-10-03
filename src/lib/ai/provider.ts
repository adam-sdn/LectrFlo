import "server-only";
import { ApiError } from "@/lib/api";

export type AiPart = { text: string } | { image: { mimeType: string; data: string } };

export interface AiRequest {
  system: string;
  /** Prior turns, oldest first. */
  history?: { role: "user" | "model"; text: string }[];
  parts: AiPart[];
  json?: boolean;
  maxOutputTokens?: number;
}

export interface AiProvider {
  model: string;
  generate(req: AiRequest): Promise<string>;
}

export class AiProviderError extends Error {}

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
const RETRYABLE_STATUSES = [429, 500, 503];
// Two attempts plus the retry pause must fit within the routes' 60 s maxDuration (Vercel).
const ATTEMPT_TIMEOUT_MS = 25_000;

function geminiProvider(apiKey: string, model: string, baseUrl: string): AiProvider {
  async function call(body: string): Promise<Response> {
    return fetch(`${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body,
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    });
  }

  return {
    model,
    async generate(req) {
      const body = JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [
          ...(req.history ?? []).map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
          {
            role: "user",
            parts: req.parts.map((p) =>
              "text" in p ? { text: p.text } : { inlineData: { mimeType: p.image.mimeType, data: p.image.data } },
            ),
          },
        ],
        generationConfig: {
          // Thinking models spend output tokens on reasoning, so keep this generous.
          maxOutputTokens: req.maxOutputTokens ?? 8192,
          ...(req.json ? { responseMimeType: "application/json" } : {}),
        },
      });

      let res = await call(body);
      if (RETRYABLE_STATUSES.includes(res.status)) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        res = await call(body);
      }
      if (!res.ok) {
        throw new AiProviderError(`Gemini request failed (${res.status}): ${(await res.text()).slice(0, 500)}`);
      }
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
      };
      const text = data.candidates?.[0]?.content?.parts
        ?.filter((p) => !p.thought)
        .map((p) => p.text ?? "")
        .join("")
        .trim();
      if (!text) throw new AiProviderError("Gemini returned an empty response");
      return text;
    },
  };
}

/** The configured AI provider, or null when no provider is configured. */
export function getAiProvider(): AiProvider | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return geminiProvider(
    key,
    process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    process.env.GEMINI_API_BASE_URL || GEMINI_BASE_URL,
  );
}

export function requireAiProvider(): AiProvider {
  const provider = getAiProvider();
  if (!provider) throw new ApiError(503, "ai_unavailable", "Lecture AI is not configured yet");
  return provider;
}
