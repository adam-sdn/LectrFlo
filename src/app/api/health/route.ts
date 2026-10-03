import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { getAiProvider } from "@/lib/ai/provider";
import { SLIDES_BUCKET } from "@/lib/storage";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Check = { ok: boolean; detail: string };

const keyKind = (key: string | undefined) =>
  !key
    ? "missing"
    : key.startsWith("sb_publishable_")
      ? "publishable key"
      : key.startsWith("sb_secret_")
        ? "secret key"
        : key.startsWith("eyJ")
          ? "legacy JWT key"
          : "unrecognised format";

// 1x1 transparent PNG used for the storage write test.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function run(fn: () => Promise<string>): Promise<Check> {
  try {
    return { ok: true, detail: await fn() };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Deployment diagnostics. Reports configuration and connectivity without revealing
 * secret values. `?write=1` also uploads and deletes a 1-pixel test image.
 */
export const GET = route(async (req) => {
  const write = new URL(req.url).searchParams.get("write") === "1";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const checks: Record<string, Check> = {};

  checks.environment = {
    ok: Boolean(url && anonKey && serviceKey),
    detail: [
      `NEXT_PUBLIC_SUPABASE_URL=${url ? new URL(url).host : "missing"}`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY=${keyKind(anonKey)}`,
      `SUPABASE_SERVICE_ROLE_KEY=${keyKind(serviceKey)}`,
      `GEMINI_API_KEY=${process.env.GEMINI_API_KEY ? "set" : "missing"}`,
      `model=${getAiProvider()?.model ?? "none"}`,
    ].join(", "),
  };
  if (!checks.environment.ok) return NextResponse.json({ ok: false, checks });

  const db = adminClient();
  checks.databaseRead = await run(async () => {
    const { count, error } = await db.from("lectures").select("id", { count: "exact", head: true });
    if (error) throw new Error(`${error.code ?? ""} ${error.message}`.trim());
    return `${count ?? 0} lectures`;
  });
  checks.databaseWrite = await run(async () => {
    // Insert with a non-existent lecturer: a foreign-key error (23503) proves inserts are permitted.
    const { error } = await db
      .from("lectures")
      .insert({ lecturer_id: "00000000-0000-0000-0000-000000000000", title: "health check", join_code: "HEALTH" });
    if (error?.code === "23503") return "insert permitted";
    if (error) throw new Error(`${error.code ?? ""} ${error.message}`.trim());
    return "insert permitted";
  });
  checks.slideBucket = await run(async () => {
    const { data, error } = await db.storage.getBucket(SLIDES_BUCKET);
    if (error) throw new Error(error.message);
    return `bucket "${data.id}" exists (public=${data.public})`;
  });
  if (write) {
    checks.slideUpload = await run(async () => {
      const path = `health-check/${randomUUID()}.png`;
      const { error } = await db.storage
        .from(SLIDES_BUCKET)
        .upload(path, new Blob([PNG], { type: "image/png" }), { contentType: "image/png" });
      if (error) throw new Error(error.message);
      await db.storage.from(SLIDES_BUCKET).remove([path]);
      return "uploaded and removed a test image";
    });
  }
  checks.realtime = await run(async () => {
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ topic: "health-check", event: "ping", payload: {}, private: false }] }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`broadcast HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return `broadcast HTTP ${res.status}`;
  });
  checks.anonymousSignIns = await run(async () => {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anonKey! }, signal: AbortSignal.timeout(5000) });
    const settings = (await res.json()) as { external?: { anonymous_users?: boolean } };
    if (!settings.external?.anonymous_users) throw new Error("anonymous sign-ins are disabled");
    return "enabled";
  });

  return NextResponse.json({ ok: Object.values(checks).every((c) => c.ok), checks });
});
