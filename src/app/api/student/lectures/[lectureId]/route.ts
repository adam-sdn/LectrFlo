import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { requireParticipant } from "@/lib/auth";
import { toLectureSummary } from "@/lib/db";
import { loadObjectives, loadSlides } from "@/lib/lectures";
import { revealedSlideLimit } from "@/lib/lifecycle";
import { lectureChannel } from "@/lib/realtime";
import { signSlides } from "@/lib/storage";
import { adminClient } from "@/lib/supabase/admin";
import type { StudentLectureState } from "@/lib/types";

type Ctx = { params: Promise<{ lectureId: string }> };

/** Full student view of the lecture. Refetch on realtime events and after reconnecting. */
export const GET = route<Ctx>(async (_req, { params }) => {
  const { participant, lecture } = await requireParticipant((await params).lectureId);
  const [slides, objectives] = await Promise.all([
    loadSlides(lecture.id),
    loadObjectives(lecture.id),
    adminClient()
      .from("lecture_participants")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", participant.id),
  ]);
  const limit = revealedSlideLimit(lecture.status, lecture.current_slide, slides.length);

  const state: StudentLectureState = {
    lecture: toLectureSummary(lecture, slides.length),
    slides: await signSlides(slides.filter((s) => s.slide_number <= limit)),
    objectives,
    participant: { id: participant.id, displayName: participant.display_name },
    realtime: { channel: lectureChannel(lecture.id) },
  };
  return NextResponse.json(state);
});
