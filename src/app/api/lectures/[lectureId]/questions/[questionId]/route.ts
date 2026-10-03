import { NextResponse } from "next/server";
import { maybe, notFound, parseBody, parseId, route } from "@/lib/api";
import { requireOwnedLecture } from "@/lib/auth";
import { QUESTION_COLUMNS, toLecturerQuestion, type QuestionRow } from "@/lib/db";
import { adminClient } from "@/lib/supabase/admin";
import { updateQuestionSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ lectureId: string; questionId: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { lectureId, questionId } = await params;
  const { lecture } = await requireOwnedLecture(req, lectureId);
  const id = parseId(questionId, "Question");
  const { status } = await parseBody(req, updateQuestionSchema);

  const row = maybe(
    await adminClient()
      .from("student_questions")
      .update({ status, answered_at: status === "answered" ? new Date().toISOString() : null })
      .eq("id", id)
      .eq("lecture_id", lecture.id)
      .select(QUESTION_COLUMNS)
      .maybeSingle<QuestionRow>(),
  );
  if (!row) throw notFound("Question");
  return NextResponse.json({ question: toLecturerQuestion(row) });
});
