import { NextResponse } from "next/server";
import { ApiError, must, parseBody, route } from "@/lib/api";
import { buildLectureContext } from "@/lib/ai/context";
import { tutorSystemPrompt } from "@/lib/ai/prompts";
import { requireAiProvider, type AiPart } from "@/lib/ai/provider";
import { requireParticipant } from "@/lib/auth";
import { AI_MESSAGE_COLUMNS, toAiMessage, type AiMessageRow } from "@/lib/db";
import { loadObjectives, loadSlides } from "@/lib/lectures";
import { revealedSlideLimit } from "@/lib/lifecycle";
import { AI_MESSAGE_LIMIT, windowStart } from "@/lib/limits";
import { downloadSlideImage } from "@/lib/storage";
import { adminClient } from "@/lib/supabase/admin";
import { askAiSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ lectureId: string }> };

// AI calls can take a while; fits every Vercel plan.
export const maxDuration = 60;

const HISTORY_TURNS = 10;

/** The student's private Lecture AI conversation, oldest first. */
export const GET = route<Ctx>(async (_req, { params }) => {
  const { participant } = await requireParticipant((await params).lectureId);
  const rows = must(
    await adminClient()
      .from("ai_messages")
      .select(AI_MESSAGE_COLUMNS)
      .eq("participant_id", participant.id)
      .order("created_at")
      .returns<AiMessageRow[]>(),
  );
  return NextResponse.json({ messages: rows.map(toAiMessage) });
});

/**
 * Asks Lecture AI. Returns the stored student message and the assistant reply.
 * On provider failure returns 502 `ai_failed` with the failed student message in details.
 */
export const POST = route<Ctx>(async (req, { params }) => {
  const { participant, lecture } = await requireParticipant((await params).lectureId);
  const { message } = await parseBody(req, askAiSchema);
  const provider = requireAiProvider();
  const db = adminClient();

  const { count, error } = await db
    .from("ai_messages")
    .select("id", { count: "exact", head: true })
    .eq("participant_id", participant.id)
    .eq("role", "student")
    .gte("created_at", windowStart(AI_MESSAGE_LIMIT.windowSeconds));
  if (error) throw new Error(`Database error: ${error.message}`);
  if ((count ?? 0) >= AI_MESSAGE_LIMIT.max) {
    throw new ApiError(429, "rate_limited", "You've asked a lot of questions quickly. Wait a few minutes.", {
      retryAfterSeconds: AI_MESSAGE_LIMIT.windowSeconds,
    });
  }

  const [slides, objectives, previous] = await Promise.all([
    loadSlides(lecture.id),
    loadObjectives(lecture.id),
    db
      .from("ai_messages")
      .select(AI_MESSAGE_COLUMNS)
      .eq("participant_id", participant.id)
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(HISTORY_TURNS)
      .returns<AiMessageRow[]>()
      .then(must),
  ]);

  const revealed = revealedSlideLimit(lecture.status, lecture.current_slide, slides.length);
  const currentSlide = revealed > 0 ? Math.min(lecture.current_slide, revealed) : null;
  const visibleSlides = slides.filter((s) => s.slide_number <= revealed);

  const studentMessage = must(
    await db
      .from("ai_messages")
      .insert({
        lecture_id: lecture.id,
        participant_id: participant.id,
        role: "student",
        content: message,
        slide_number: currentSlide,
        status: "pending",
      })
      .select(AI_MESSAGE_COLUMNS)
      .single<AiMessageRow>(),
  );

  const parts: AiPart[] = [{ text: message }];
  const slideRow = currentSlide ? slides.find((s) => s.slide_number === currentSlide) : undefined;
  const image = slideRow ? await downloadSlideImage(slideRow.storage_path) : null;
  if (image) parts.push({ image });

  const history = previous.reverse();
  // The conversation sent to the model must open with a student turn.
  while (history[0]?.role === "assistant") history.shift();

  let reply: string;
  try {
    reply = await provider.generate({
      system: tutorSystemPrompt(buildLectureContext(lecture, objectives, visibleSlides), currentSlide),
      history: history.map((m) => ({ role: m.role === "student" ? "user" : "model", text: m.content })),
      parts,
      maxOutputTokens: 4096,
    });
  } catch (err) {
    console.error("Lecture AI request failed", err);
    const failed = must(
      await db
        .from("ai_messages")
        .update({ status: "failed", error: "provider_error" })
        .eq("id", studentMessage.id)
        .select(AI_MESSAGE_COLUMNS)
        .single<AiMessageRow>(),
    );
    throw new ApiError(502, "ai_failed", "Lecture AI couldn't answer right now. Try again.", {
      message: toAiMessage(failed),
    });
  }

  const [completed, assistant] = await Promise.all([
    db
      .from("ai_messages")
      .update({ status: "complete" })
      .eq("id", studentMessage.id)
      .select(AI_MESSAGE_COLUMNS)
      .single<AiMessageRow>()
      .then(must),
    db
      .from("ai_messages")
      .insert({
        lecture_id: lecture.id,
        participant_id: participant.id,
        role: "assistant",
        content: reply.slice(0, 20000),
        slide_number: currentSlide,
        status: "complete",
      })
      .select(AI_MESSAGE_COLUMNS)
      .single<AiMessageRow>()
      .then(must),
  ]);
  return NextResponse.json({ messages: [toAiMessage(completed), toAiMessage(assistant)] }, { status: 201 });
});
