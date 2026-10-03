import { NextResponse } from "next/server";
import { ApiError, must, parseBody, route } from "@/lib/api";
import { requireParticipant } from "@/lib/auth";
import { ANNOTATION_COLUMNS, toAnnotation, type AnnotationRow } from "@/lib/db";
import { countSlides } from "@/lib/lectures";
import { revealedSlideLimit } from "@/lib/lifecycle";
import { adminClient } from "@/lib/supabase/admin";
import { createAnnotationSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ lectureId: string }> };

/** The student's own annotations, ordered by slide. Optional `?slide=N` filter. */
export const GET = route<Ctx>(async (req, { params }) => {
  const { participant } = await requireParticipant((await params).lectureId);
  const slide = Number(new URL(req.url).searchParams.get("slide"));
  let query = adminClient().from("slide_annotations").select(ANNOTATION_COLUMNS).eq("participant_id", participant.id);
  if (Number.isInteger(slide) && slide > 0) query = query.eq("slide_number", slide);
  const rows = must(
    await query.order("slide_number").order("created_at").returns<AnnotationRow[]>(),
  );
  return NextResponse.json({ annotations: rows.map(toAnnotation) });
});

export const POST = route<Ctx>(async (req, { params }) => {
  const { participant, lecture } = await requireParticipant((await params).lectureId);
  const input = await parseBody(req, createAnnotationSchema);
  const limit = revealedSlideLimit(lecture.status, lecture.current_slide, await countSlides(lecture.id));
  if (input.slideNumber > limit) {
    throw new ApiError(400, "invalid_slide", "You can only annotate slides that have been shown");
  }
  const row = must(
    await adminClient()
      .from("slide_annotations")
      .insert({
        lecture_id: lecture.id,
        participant_id: participant.id,
        slide_number: input.slideNumber,
        content: input.content,
        x: input.x ?? null,
        y: input.y ?? null,
      })
      .select(ANNOTATION_COLUMNS)
      .single<AnnotationRow>(),
  );
  return NextResponse.json({ annotation: toAnnotation(row) }, { status: 201 });
});
