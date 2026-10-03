import { NextResponse } from "next/server";
import { ApiError, maybe, parseBody, route } from "@/lib/api";
import { requireOwnedLecture } from "@/lib/auth";
import { LECTURE_COLUMNS, toLecturerLecture, type LectureRow } from "@/lib/db";
import { broadcastLectureState, countSlides } from "@/lib/lectures";
import { TRANSITIONS } from "@/lib/lifecycle";
import { adminClient } from "@/lib/supabase/admin";
import { lifecycleSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ lectureId: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { lecture } = await requireOwnedLecture(req, (await params).lectureId);
  const { action } = await parseBody(req, lifecycleSchema);
  const transition = TRANSITIONS[action];

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: transition.to };
  if (action === "start") patch.started_at = now;
  if (action === "end") patch.ended_at = now;

  // Conditional on the current status so concurrent requests cannot double-transition.
  const updated = maybe(
    await adminClient()
      .from("lectures")
      .update(patch)
      .eq("id", lecture.id)
      .in("status", transition.from)
      .select(LECTURE_COLUMNS)
      .maybeSingle<LectureRow>(),
  );
  if (!updated) {
    throw new ApiError(409, "invalid_transition", `Cannot ${action} a lecture that is ${lecture.status}`);
  }

  await broadcastLectureState(updated);
  return NextResponse.json({ lecture: toLecturerLecture(updated, await countSlides(lecture.id)) });
});
