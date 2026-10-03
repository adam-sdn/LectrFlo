import { NextResponse } from "next/server";
import { maybe, must, notFound, parseBody, parseId, route } from "@/lib/api";
import { requireParticipant } from "@/lib/auth";
import { ANNOTATION_COLUMNS, toAnnotation, type AnnotationRow } from "@/lib/db";
import { adminClient } from "@/lib/supabase/admin";
import { updateAnnotationSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ lectureId: string; annotationId: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { lectureId, annotationId } = await params;
  const { participant } = await requireParticipant(lectureId);
  const id = parseId(annotationId, "Annotation");
  const input = await parseBody(req, updateAnnotationSchema);
  const row = maybe(
    await adminClient()
      .from("slide_annotations")
      .update(input)
      .eq("id", id)
      .eq("participant_id", participant.id)
      .select(ANNOTATION_COLUMNS)
      .maybeSingle<AnnotationRow>(),
  );
  if (!row) throw notFound("Annotation");
  return NextResponse.json({ annotation: toAnnotation(row) });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { lectureId, annotationId } = await params;
  const { participant } = await requireParticipant(lectureId);
  const id = parseId(annotationId, "Annotation");
  const rows = must(
    await adminClient()
      .from("slide_annotations")
      .delete()
      .eq("id", id)
      .eq("participant_id", participant.id)
      .select("id"),
  );
  if (rows.length === 0) throw notFound("Annotation");
  return new NextResponse(null, { status: 204 });
});
