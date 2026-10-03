import { NextResponse } from "next/server";
import { ApiError, must, parseBody, route } from "@/lib/api";
import { requireOwnedLecture, requireStatus } from "@/lib/auth";
import { LECTURE_COLUMNS, toLecturerLecture, type LectureRow } from "@/lib/db";
import { broadcastLectureState, countSlides } from "@/lib/lectures";
import { adminClient } from "@/lib/supabase/admin";
import { setSlideSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ lectureId: string }> };

export const PUT = route<Ctx>(async (req, { params }) => {
  const { lecture } = await requireOwnedLecture(req, (await params).lectureId);
  requireStatus(lecture, ["draft", "lobby", "live"], "change slides");
  const { slideNumber } = await parseBody(req, setSlideSchema);
  const slideCount = await countSlides(lecture.id);
  if (slideNumber > slideCount) {
    throw new ApiError(400, "invalid_slide", `Slide ${slideNumber} does not exist (lecture has ${slideCount})`);
  }

  const updated = must(
    await adminClient()
      .from("lectures")
      .update({ current_slide: slideNumber })
      .eq("id", lecture.id)
      .select(LECTURE_COLUMNS)
      .single<LectureRow>(),
  );
  await broadcastLectureState(updated);
  return NextResponse.json({ lecture: toLecturerLecture(updated, slideCount) });
});
