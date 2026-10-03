import "server-only";
import { check, maybe, must } from "@/lib/api";
import { AI_REPORT_COLUMNS, type AiReportRow } from "@/lib/db";
import { adminClient } from "@/lib/supabase/admin";
import type { AiProvider } from "@/lib/ai/provider";

type ReportKind = "student_recap" | "lecturer_insight";

// A pending report younger than this is assumed to still be generating.
const PENDING_STALE_MS = 2 * 60 * 1000;

export async function loadReport(lectureId: string, kind: ReportKind, participantId: string | null) {
  let query = adminClient().from("ai_reports").select(AI_REPORT_COLUMNS).eq("lecture_id", lectureId).eq("kind", kind);
  query = participantId ? query.eq("participant_id", participantId) : query.is("participant_id", null);
  return maybe(await query.maybeSingle<AiReportRow>());
}

/**
 * Generates (or returns the existing) AI report. Persists pending/complete/failed
 * so clients can poll GET while a generation is in flight.
 */
export async function runReport(opts: {
  lectureId: string;
  kind: ReportKind;
  participantId: string | null;
  regenerate: boolean;
  provider: AiProvider;
  generate: () => Promise<unknown>;
}): Promise<AiReportRow> {
  const { lectureId, kind, participantId } = opts;
  const existing = await loadReport(lectureId, kind, participantId);
  if (existing?.status === "complete" && !opts.regenerate) return existing;
  if (existing?.status === "pending" && Date.now() - Date.parse(existing.updated_at) < PENDING_STALE_MS) {
    return existing;
  }

  const db = adminClient();
  check(
    await db.from("ai_reports").upsert(
      {
        lecture_id: lectureId,
        kind,
        participant_id: participantId,
        status: "pending",
        error: null,
        model: opts.provider.model,
      },
      { onConflict: "lecture_id,kind,participant_id" },
    ),
  );

  let update: Record<string, unknown>;
  try {
    update = { status: "complete", content: await opts.generate(), error: null };
  } catch (err) {
    console.error(`AI ${kind} generation failed`, err);
    update = { status: "failed", error: "Generation failed. Try again." };
  }

  let query = db.from("ai_reports").update(update).eq("lecture_id", lectureId).eq("kind", kind);
  query = participantId ? query.eq("participant_id", participantId) : query.is("participant_id", null);
  return must(await query.select(AI_REPORT_COLUMNS).single<AiReportRow>());
}
