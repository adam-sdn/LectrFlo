import { NextResponse } from "next/server";
import { ApiError, maybe, notFound, parseBody, route } from "@/lib/api";
import { requireOwnedLecture } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { slideTextSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ lectureId: string; slideNumber: string }> };

/** Sets the slide's text content, which Lecture AI uses as context. */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const { lectureId, slideNumber } = await params;
  const { lecture } = await requireOwnedLecture(req, lectureId);
  const n = Number(slideNumber);
  if (!Number.isInteger(n) || n < 1) throw new ApiError(400, "invalid_slide", "Invalid slide number");
  const { textContent } = await parseBody(req, slideTextSchema);

  const row = maybe(
    await adminClient()
      .from("lecture_slides")
      .update({ text_content: textContent?.trim() || null })
      .eq("lecture_id", lecture.id)
      .eq("slide_number", n)
      .select("slide_number, text_content")
      .maybeSingle<{ slide_number: number; text_content: string | null }>(),
  );
  if (!row) throw notFound("Slide");
  return NextResponse.json({ slide: { slideNumber: row.slide_number, textContent: row.text_content } });
});
