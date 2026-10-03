import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { requireOwnedLecture } from "@/lib/auth";
import { confusionBySlide, countParticipants } from "@/lib/lectures";
import { CONFUSION_WINDOW_SECONDS, windowStart } from "@/lib/limits";
import type { ConfusionSummary } from "@/lib/types";

type Ctx = { params: Promise<{ lectureId: string }> };

/** Aggregate, anonymous confusion signals for the lecturer dashboard. */
export const GET = route<Ctx>(async (req, { params }) => {
  const { lecture } = await requireOwnedLecture(req, (await params).lectureId);
  const [bySlide, recent, participantCount] = await Promise.all([
    confusionBySlide(lecture.id),
    confusionBySlide(lecture.id, windowStart(CONFUSION_WINDOW_SECONDS)),
    countParticipants(lecture.id),
  ]);
  const summary: ConfusionSummary = {
    windowSeconds: CONFUSION_WINDOW_SECONDS,
    currentSlide: lecture.current_slide,
    recentUniqueStudents: recent.find((s) => s.slideNumber === lecture.current_slide)?.uniqueStudents ?? 0,
    participantCount,
    bySlide,
  };
  return NextResponse.json(summary);
});
