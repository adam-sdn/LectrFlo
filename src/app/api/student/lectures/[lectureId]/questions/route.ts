import { NextResponse } from "next/server";
import { ApiError, must, parseBody, route } from "@/lib/api";
import { requireParticipant, requireStatus } from "@/lib/auth";
import { QUESTION_COLUMNS, toLecturerQuestion, toStudentQuestion, type QuestionRow } from "@/lib/db";
import { QUESTION_LIMIT, windowStart } from "@/lib/limits";
import { hostChannel } from "@/lib/realtime";
import { broadcastHost } from "@/lib/realtime-server";
import { adminClient } from "@/lib/supabase/admin";
import { askQuestionSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ lectureId: string }> };

/** The student's own questions to the lecturer, oldest first. */
export const GET = route<Ctx>(async (_req, { params }) => {
  const { participant } = await requireParticipant((await params).lectureId);
  const rows = must(
    await adminClient()
      .from("student_questions")
      .select(QUESTION_COLUMNS)
      .eq("participant_id", participant.id)
      .order("created_at")
      .returns<QuestionRow[]>(),
  );
  return NextResponse.json({ questions: rows.map(toStudentQuestion) });
});

/** Sends a question to the lecturer (anonymous to the lecturer), tagged with the current slide. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { participant, lecture } = await requireParticipant((await params).lectureId);
  requireStatus(lecture, ["live"], "ask the lecturer a question");
  const { body } = await parseBody(req, askQuestionSchema);
  const db = adminClient();

  const { count, error } = await db
    .from("student_questions")
    .select("id", { count: "exact", head: true })
    .eq("participant_id", participant.id)
    .gte("created_at", windowStart(QUESTION_LIMIT.windowSeconds));
  if (error) throw new Error(`Database error: ${error.message}`);
  if ((count ?? 0) >= QUESTION_LIMIT.max) {
    throw new ApiError(429, "rate_limited", "You're sending questions too quickly. Wait a moment.", {
      retryAfterSeconds: QUESTION_LIMIT.windowSeconds,
    });
  }

  const row = must(
    await db
      .from("student_questions")
      .insert({ lecture_id: lecture.id, participant_id: participant.id, slide_number: lecture.current_slide, body })
      .select(QUESTION_COLUMNS)
      .single<QuestionRow>(),
  );
  await broadcastHost(hostChannel(lecture.host_channel_key), "question_created", {
    question: toLecturerQuestion(row),
  });
  return NextResponse.json({ question: toStudentQuestion(row) }, { status: 201 });
});
