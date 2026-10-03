import { NextResponse } from "next/server";
import { must, route } from "@/lib/api";
import { requireOwnedLecture } from "@/lib/auth";
import { QUESTION_COLUMNS, toLecturerQuestion, type QuestionRow } from "@/lib/db";
import { adminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ lectureId: string }> };

/** All questions for the lecture, oldest first. Student identities are not exposed. */
export const GET = route<Ctx>(async (req, { params }) => {
  const { lecture } = await requireOwnedLecture(req, (await params).lectureId);
  const rows = must(
    await adminClient()
      .from("student_questions")
      .select(QUESTION_COLUMNS)
      .eq("lecture_id", lecture.id)
      .order("created_at")
      .returns<QuestionRow[]>(),
  );
  return NextResponse.json({ questions: rows.map(toLecturerQuestion) });
});
