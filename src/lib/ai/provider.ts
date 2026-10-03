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
// Gemma 4 (served by the Gemini API). The 26B MoE model answers in seconds; the dense
// 31B model was too slow for live tutoring in testing.
export const DEFAULT_GEMINI_MODEL = "gemma-4-26b-a4b-it";
// Minimal thinking keeps Gemma 4 fast (a recap took ~12 s instead of ~55 s) and its JSON valid.
const DEFAULT_THINKING_LEVEL = "minimal";
const RETRYABLE_STATUSES = [429, 500, 503];
// Budget for all attempts of one request; must fit the AI routes' 60 s maxDuration (Vercel).
const DEADLINE_MS = 55_000;
const MIN_RETRY_MS = 10_000;

// Models that rejected thinkingConfig; later requests skip it.
const thinkingUnsupported = new Set<string>();

function geminiProvider(apiKey: string, model: string, baseUrl: string, thinkingLevel: string | null): AiProvider {
  return {
    model,
    async generate(req) {
      const deadline = Date.now() + DEADLINE_MS;
      const body = (withThinking: boolean) =>
        JSON.stringify({
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
            // Thinking tokens count towards this limit, so keep it generous.
            maxOutputTokens: req.maxOutputTokens ?? 8192,
            ...(req.json ? { responseMimeType: "application/json" } : {}),
            ...(withThinking ? { thinkingConfig: { thinkingLevel } } : {}),
          },
        });
      const call = async (withThinking: boolean) => {
        try {
          return await fetch(`${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: body(withThinking),
            signal: AbortSignal.timeout(Math.max(1000, deadline - Date.now())),
          });
        } catch (err) {
          throw new AiProviderError(`Gemini request failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      };

      let withThinking = Boolean(thinkingLevel) && !thinkingUnsupported.has(model);
      let res = await call(withThinking);
      if (res.status === 400 && withThinking && /thinking/i.test(await res.clone().text())) {
        thinkingUnsupported.add(model);
        withThinking = false;
        res = await call(false);
      }
      if (RETRYABLE_STATUSES.includes(res.status) && deadline - Date.now() > MIN_RETRY_MS) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        res = await call(withThinking);
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
  const level = process.env.GEMINI_THINKING_LEVEL;
  return geminiProvider(
    key,
    process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    process.env.GEMINI_API_BASE_URL || GEMINI_BASE_URL,
    level === undefined ? DEFAULT_THINKING_LEVEL : level && level !== "off" ? level : null,
  );
}

export function requireAiProvider(): AiProvider {
  const provider = getAiProvider();
  if (!provider) throw new ApiError(503, "ai_unavailable", "Lecture AI is not configured yet");
  return provider;
}
