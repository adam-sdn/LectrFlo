import { NextResponse } from "next/server";
import { ApiError, maybe, must, route } from "@/lib/api";
import { requireParticipant, requireStatus } from "@/lib/auth";
import { confusionBySlide, countParticipants } from "@/lib/lectures";
import { CONFUSION_COOLDOWN_SECONDS, CONFUSION_WINDOW_SECONDS, cooldownRemaining, windowStart } from "@/lib/limits";
import { hostChannel } from "@/lib/realtime";
import { broadcastHost } from "@/lib/realtime-server";
import { adminClient } from "@/lib/supabase/admin";
import type { ConfusionResponse } from "@/lib/types";

type Ctx = { params: Promise<{ lectureId: string }> };

/** Records an "I'm confused" signal on the current slide. No body. */
export const POST = route<Ctx>(async (_req, { params }) => {
  const { participant, lecture } = await requireParticipant((await params).lectureId);
  requireStatus(lecture, ["live"], "send a confusion signal");
  const db = adminClient();

  const last = maybe(
    await db
      .from("confusion_signals")
      .select("created_at")
      .eq("participant_id", participant.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ created_at: string }>(),
  );
  const wait = cooldownRemaining(last ? new Date(last.created_at) : null, CONFUSION_COOLDOWN_SECONDS);
  if (wait > 0) {
    throw new ApiError(429, "cooldown", `You can signal again in ${wait}s`, { retryAfterSeconds: wait });
  }

  const signal = must(
    await db
      .from("confusion_signals")
      .insert({ lecture_id: lecture.id, participant_id: participant.id, slide_number: lecture.current_slide })
      .select("slide_number, created_at")
      .single<{ slide_number: number; created_at: string }>(),
  );

  const [recent, participantCount] = await Promise.all([
    confusionBySlide(lecture.id, windowStart(CONFUSION_WINDOW_SECONDS)),
    countParticipants(lecture.id),
  ]);
  await broadcastHost(hostChannel(lecture.host_channel_key), "confusion", {
    slideNumber: signal.slide_number,
    recentUniqueStudents: recent.find((s) => s.slideNumber === signal.slide_number)?.uniqueStudents ?? 0,
    windowSeconds: CONFUSION_WINDOW_SECONDS,
    participantCount,
    at: signal.created_at,
  });

  const body: ConfusionResponse = {
    slideNumber: signal.slide_number,
    createdAt: signal.created_at,
    cooldownSeconds: CONFUSION_COOLDOWN_SECONDS,
  };
  return NextResponse.json(body, { status: 201 });
});
