import { NextResponse } from "next/server";
import { ApiError, must, route } from "@/lib/api";
import { requireParticipant } from "@/lib/auth";
import type { LectureRow, ParticipantRow } from "@/lib/db";
import { loadObjectives, loadSlides } from "@/lib/lectures";
import { revealedSlideLimit } from "@/lib/lifecycle";
import { adminClient } from "@/lib/supabase/admin";
import { createSignedUrl, voiceConfig } from "@/lib/voice";
import { buildVoiceVariables, describeSlide } from "@/lib/voice-context";

type Ctx = { params: Promise<{ lectureId: string }> };

async function currentSlide(lecture: LectureRow) {
  const slides = await loadSlides(lecture.id);
  const revealed = revealedSlideLimit(lecture.status, lecture.current_slide, slides.length);
  const number = revealed > 0 ? Math.min(lecture.current_slide, revealed) : null;
  const text = number ? (slides.find((s) => s.slide_number === number)?.text_content ?? null) : null;
  return { number, text, slideCount: slides.length };
}

async function confusedSlides(participant: ParticipantRow) {
  const rows = must(
    await adminClient()
      .from("confusion_signals")
      .select("slide_number")
      .eq("participant_id", participant.id)
      .returns<{ slide_number: number }[]>(),
  );
  return [...new Set(rows.map((r) => r.slide_number))].sort((a, b) => a - b);
}

/** Current slide for the voice agent's get_current_slide tool (only slides the student has been shown). */
export const GET = route<Ctx>(async (_req, { params }) => {
  const { lecture } = await requireParticipant((await params).lectureId);
  const slide = await currentSlide(lecture);
  return NextResponse.json({
    status: lecture.status,
    slideNumber: slide.number,
    slideCount: slide.slideCount,
    summary: describeSlide(slide.number, slide.slideCount, slide.text),
  });
});

/** Starts a private ElevenLabs voice session: returns a signed URL plus this student's lecture context. */
export const POST = route<Ctx>(async (_req, { params }) => {
  const { participant, lecture } = await requireParticipant((await params).lectureId);
  const config = voiceConfig();
  if (!config) throw new ApiError(503, "voice_unavailable", "The voice tutor isn't set up yet");

  const [slide, objectives, confused] = await Promise.all([
    currentSlide(lecture),
    loadObjectives(lecture.id),
    confusedSlides(participant),
  ]);
  const signedUrl = await createSignedUrl(config);
  return NextResponse.json({
    signedUrl,
    dynamicVariables: buildVoiceVariables({
      studentName: participant.display_name,
      lectureTitle: lecture.title,
      module: lecture.module,
      objectives: objectives.map((o) => o.text),
      currentSlide: slide.number,
      slideText: slide.text,
      confusedSlides: confused,
    }),
  });
});
