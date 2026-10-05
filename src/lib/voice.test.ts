import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { createSignedUrl, signedUrlFailure } = await import("./voice");

const config = { apiKey: "sk_test", agentId: "agent_test", baseUrl: "https://elevenlabs.test" };

describe("signedUrlFailure", () => {
  it("names a refused key with ElevenLabs' error code", () => {
    const body = JSON.stringify({ detail: { status: "missing_permissions", message: "The API key you used is missing the permission convai_write" } });
    expect(signedUrlFailure(401, body)).toBe(
      "The voice tutor couldn't start: ElevenLabs refused the server's API key (401 missing_permissions).",
    );
  });

  it("names a missing agent and falls back to the status for non-JSON bodies", () => {
    expect(signedUrlFailure(404, "Not Found")).toBe("The voice tutor couldn't start: ElevenLabs couldn't find the voice agent (404).");
  });

  it("never echoes free text from the response", () => {
    expect(signedUrlFailure(500, JSON.stringify({ detail: { status: "Some <b>long</b> message" } }))).toBe(
      "The voice tutor couldn't start: ElevenLabs returned an error (500).",
    );
    expect(signedUrlFailure(422, JSON.stringify({ detail: [{ msg: "field required" }] }))).toBe(
      "The voice tutor couldn't start: ElevenLabs returned an error (422).",
    );
    expect(signedUrlFailure(429, "null")).toBe(
      "The voice tutor couldn't start: ElevenLabs is over its usage or concurrency limit (429).",
    );
  });
});

describe("createSignedUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns the signed URL", async () => {
    const fetch = vi.fn(async () => Response.json({ signed_url: "wss://signed" }));
    vi.stubGlobal("fetch", fetch);
    await expect(createSignedUrl(config)).resolves.toBe("wss://signed");
    expect(fetch).toHaveBeenCalledWith(
      "https://elevenlabs.test/v1/convai/conversation/get-signed-url?agent_id=agent_test",
      expect.objectContaining({ headers: { "xi-api-key": "sk_test" } }),
    );
  });

  it("surfaces why ElevenLabs refused as a 502 voice_failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", async () => Response.json({ detail: { status: "invalid_api_key" } }, { status: 401 }));
    await expect(createSignedUrl(config)).rejects.toMatchObject({
      status: 502,
      code: "voice_failed",
      message: "The voice tutor couldn't start: ElevenLabs refused the server's API key (401 invalid_api_key).",
    });
  });
});
