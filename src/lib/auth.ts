import "server-only";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { ApiError, maybe, must, notFound, parseId } from "@/lib/api";
import { LECTURE_COLUMNS, type LectureRow, type ParticipantRow } from "@/lib/db";
import { PARTICIPANT_COOKIE_MAX_AGE } from "@/lib/limits";
import { adminClient } from "@/lib/supabase/admin";
import { serverClient } from "@/lib/supabase/server";
import { hashToken, participantCookieName } from "@/lib/tokens";

/**
 * Resolves the signed-in lecturer from the Supabase auth cookie, or from an
 * `Authorization: Bearer <access token>` header for non-browser clients.
 */
export async function requireLecturer(req: Request): Promise<User> {
  const header = req.headers.get("authorization");
  const bearer = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  const { data } = bearer
    ? await adminClient().auth.getUser(bearer)
    : await (await serverClient()).auth.getUser();
  if (!data.user) throw new ApiError(401, "unauthenticated", "Sign in as a lecturer to continue");
  return data.user;
}

/** Loads a lecture owned by the lecturer. Returns 404 (not 403) for other lecturers' lectures. */
export async function requireOwnedLecture(req: Request, rawLectureId: string) {
  const user = await requireLecturer(req);
  const lectureId = parseId(rawLectureId);
  const lecture = maybe(
    await adminClient()
      .from("lectures")
      .select(LECTURE_COLUMNS)
      .eq("id", lectureId)
      .eq("lecturer_id", user.id)
      .maybeSingle<LectureRow>(),
  );
  if (!lecture) throw notFound();
  return { user, lecture };
}

/** Resolves the student's participant session for a lecture from their httpOnly cookie. */
export async function requireParticipant(rawLectureId: string) {
  const lectureId = parseId(rawLectureId);
  const token = (await cookies()).get(participantCookieName(lectureId))?.value;
  if (!token) throw new ApiError(401, "not_joined", "Join the lecture to continue");

  const db = adminClient();
  const participant = maybe(
    await db
      .from("lecture_participants")
      .select("id, lecture_id, display_name, joined_at")
      .eq("token_hash", hashToken(token))
      .eq("lecture_id", lectureId)
      .maybeSingle<ParticipantRow>(),
  );
  if (!participant) throw new ApiError(401, "not_joined", "Your lecture session has expired. Join again.");

  const lecture = must(
    await db.from("lectures").select(LECTURE_COLUMNS).eq("id", lectureId).single<LectureRow>(),
  );
  return { participant, lecture };
}

export async function setParticipantCookie(lectureId: string, token: string) {
  (await cookies()).set(participantCookieName(lectureId), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PARTICIPANT_COOKIE_MAX_AGE,
  });
}

export function requireStatus(lecture: LectureRow, allowed: LectureRow["status"][], action: string) {
  if (!allowed.includes(lecture.status)) {
    const code = lecture.status === "ended" ? "lecture_ended" : "lecture_not_live";
    throw new ApiError(409, code, `Cannot ${action} while the lecture is ${lecture.status}`);
  }
}
