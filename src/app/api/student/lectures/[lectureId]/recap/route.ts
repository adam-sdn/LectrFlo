import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { buildLectureContext } from "@/lib/ai/context";
import { parseModelJson, studentRecapOutput, studentRecapPrompt } from "@/lib/ai/prompts";
import { requireAiProvider } from "@/lib/ai/provider";
import { loadReport, runReport } from "@/lib/ai/reports";
import { requireParticipant, requireStatus } from "@/lib/auth";
import { toAiReport, toLectureSummary, type AiReportRow, type LectureRow } from "@/lib/db";
import { countSlides, loadObjectives, loadSlides } from "@/lib/lectures";
import { loadStudentActivity, type StudentActivityData } from "@/lib/student-activity";
import type { LearningObjective, StudentRecapContent, StudentRecapResponse } from "@/lib/types";
import { regenerateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ lectureId: string }> };

// AI calls can take a while; fits every Vercel plan.
export const maxDuration = 60;

async function respond(
  lecture: LectureRow,
  objectives: LearningObjective[],
  activity: StudentActivityData,
  report: AiReportRow | null,
) {
  const body: StudentRecapResponse = {
    lecture: toLectureSummary(lecture, await countSlides(lecture.id)),
    objectives,
    report: toAiReport<StudentRecapContent>(report),
    notes: activity.notes,
    annotations: activity.annotations,
    questions: activity.questions,
    confusedSlides: activity.confusedSlides,
  };
  return NextResponse.json(body);
}

/** Recap data. `report` is null until generated; the rest works without AI. */
export const GET = route<Ctx>(async (_req, { params }) => {
  const { participant, lecture } = await requireParticipant((await params).lectureId);
  requireStatus(lecture, ["ended"], "view the recap");
  const [objectives, activity, report] = await Promise.all([
    loadObjectives(lecture.id),
    loadStudentActivity(participant.id),
    loadReport(lecture.id, "student_recap", participant.id),
  ]);
  return respond(lecture, objectives, activity, report);
});

/** Generates the AI recap. Body: `{ "regenerate": true }` to replace an existing one. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { participant, lecture } = await requireParticipant((await params).lectureId);
  requireStatus(lecture, ["ended"], "generate the recap");
  const { regenerate = false } = regenerateSchema.parse(await req.json().catch(() => undefined)) ?? {};
  const provider = requireAiProvider();
  const [objectives, activity] = await Promise.all([
    loadObjectives(lecture.id),
    loadStudentActivity(participant.id),
  ]);

  const report = await runReport({
    lectureId: lecture.id,
    kind: "student_recap",
    participantId: participant.id,
    regenerate,
    provider,
    generate: async () => {
      const slides = await loadSlides(lecture.id);
      const prompt = studentRecapPrompt(buildLectureContext(lecture, objectives, slides), {
        notes: activity.notes.content,
        annotations: activity.annotations.map((a) => ({ slideNumber: a.slideNumber, content: a.content })),
        questions: activity.questions.map((q) => q.body),
        aiQuestions: activity.aiQuestions,
        confusedSlides: activity.confusedSlides,
      });
      const text = await provider.generate({ system: prompt.system, parts: [{ text: prompt.text }], json: true });
      return parseModelJson(text, studentRecapOutput);
    },
  });
  return respond(lecture, objectives, activity, report);
});
