import { NextResponse } from "next/server";
import { must, route } from "@/lib/api";
import { buildLectureContext } from "@/lib/ai/context";
import { lecturerInsightOutput, lecturerInsightPrompt, parseModelJson } from "@/lib/ai/prompts";
import { requireAiProvider } from "@/lib/ai/provider";
import { loadReport, runReport } from "@/lib/ai/reports";
import { requireOwnedLecture, requireStatus } from "@/lib/auth";
import { toAiReport, type LectureRow } from "@/lib/db";
import { confusionBySlide, countParticipants, loadObjectives, loadSlides } from "@/lib/lectures";
import { adminClient } from "@/lib/supabase/admin";
import type { LecturerInsightContent, LecturerReportResponse } from "@/lib/types";
import { regenerateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ lectureId: string }> };

async function classStats(lecture: LectureRow) {
  const [participantCount, confusion, questions] = await Promise.all([
    countParticipants(lecture.id),
    confusionBySlide(lecture.id),
    adminClient()
      .from("student_questions")
      .select("slide_number, body")
      .eq("lecture_id", lecture.id)
      .order("created_at")
      .returns<{ slide_number: number | null; body: string }[]>()
      .then(must),
  ]);
  return { participantCount, confusion, questions };
}

function respond(report: Parameters<typeof toAiReport>[0], stats: Awaited<ReturnType<typeof classStats>>) {
  const body: LecturerReportResponse = {
    report: toAiReport<LecturerInsightContent>(report),
    stats: {
      participantCount: stats.participantCount,
      questionCount: stats.questions.length,
      confusion: stats.confusion,
    },
  };
  return NextResponse.json(body);
}

export const GET = route<Ctx>(async (req, { params }) => {
  const { lecture } = await requireOwnedLecture(req, (await params).lectureId);
  const [report, stats] = await Promise.all([loadReport(lecture.id, "lecturer_insight", null), classStats(lecture)]);
  return respond(report, stats);
});

/** Generates the post-lecture insight report. Body: `{ "regenerate": true }` to replace an existing one. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { lecture } = await requireOwnedLecture(req, (await params).lectureId);
  requireStatus(lecture, ["ended"], "generate the report");
  const { regenerate = false } = regenerateSchema.parse(await req.json().catch(() => undefined)) ?? {};
  const provider = requireAiProvider();
  const stats = await classStats(lecture);

  const report = await runReport({
    lectureId: lecture.id,
    kind: "lecturer_insight",
    participantId: null,
    regenerate,
    provider,
    generate: async () => {
      const [objectives, slides] = await Promise.all([loadObjectives(lecture.id), loadSlides(lecture.id)]);
      const prompt = lecturerInsightPrompt(buildLectureContext(lecture, objectives, slides), {
        participantCount: stats.participantCount,
        confusion: stats.confusion,
        questions: stats.questions.map((q) => ({ slideNumber: q.slide_number, body: q.body })),
      });
      const text = await provider.generate({ system: prompt.system, parts: [{ text: prompt.text }], json: true });
      return parseModelJson(text, lecturerInsightOutput);
    },
  });
  return respond(report, stats);
});
