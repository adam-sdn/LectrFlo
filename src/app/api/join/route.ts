import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { maybe, must, parseBody, route } from "@/lib/api";
import { setParticipantCookie } from "@/lib/auth";
import type { ParticipantRow } from "@/lib/db";
import { resolveJoinCode } from "@/lib/join";
import { countParticipants } from "@/lib/lectures";
import { hostChannel } from "@/lib/realtime";
import { broadcastHost } from "@/lib/realtime-server";
import { adminClient } from "@/lib/supabase/admin";
import { createSessionToken, hashToken, participantCookieName } from "@/lib/tokens";
import type { JoinResponse } from "@/lib/types";
import { joinSchema } from "@/lib/validation";

const PARTICIPANT_COLUMNS = "id, lecture_id, display_name, joined_at";

/** Joins a lecture by code. Sets an httpOnly participant cookie scoped to that lecture. */
export const POST = route(async (req) => {
  const { code, displayName } = await parseBody(req, joinSchema);
  const lecture = await resolveJoinCode(code);
  const db = adminClient();

  // Rejoining from the same browser keeps the same participant (and their notes).
  const existingToken = (await cookies()).get(participantCookieName(lecture.id))?.value;
  if (existingToken) {
    const existing = maybe(
      await db
        .from("lecture_participants")
        .update({ display_name: displayName, last_seen_at: new Date().toISOString() })
        .eq("token_hash", hashToken(existingToken))
        .eq("lecture_id", lecture.id)
        .select(PARTICIPANT_COLUMNS)
        .maybeSingle<ParticipantRow>(),
    );
    if (existing) {
      const body: JoinResponse = {
        lectureId: lecture.id,
        participant: { id: existing.id, displayName: existing.display_name },
      };
      return NextResponse.json(body);
    }
  }

  const token = createSessionToken();
  const participant = must(
    await db
      .from("lecture_participants")
      .insert({ lecture_id: lecture.id, display_name: displayName, token_hash: hashToken(token) })
      .select(PARTICIPANT_COLUMNS)
      .single<ParticipantRow>(),
  );
  await setParticipantCookie(lecture.id, token);

  await broadcastHost(hostChannel(lecture.host_channel_key), "participant_joined", {
    displayName: participant.display_name,
    joinedAt: participant.joined_at,
    participantCount: await countParticipants(lecture.id),
  });

  const body: JoinResponse = {
    lectureId: lecture.id,
    participant: { id: participant.id, displayName: participant.display_name },
  };
  return NextResponse.json(body, { status: 201 });
});
