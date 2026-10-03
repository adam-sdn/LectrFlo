import "server-only";
import { ApiError, maybe } from "@/lib/api";
import { LECTURE_COLUMNS, type LectureRow } from "@/lib/db";
import { normalizeJoinCode } from "@/lib/join-code";
import { isJoinable } from "@/lib/lifecycle";
import { adminClient } from "@/lib/supabase/admin";
import type { JoinPreview } from "@/lib/types";

/** Resolves a join code to a joinable lecture or throws a specific error for the UI. */
export async function resolveJoinCode(rawCode: string): Promise<LectureRow> {
  if (!rawCode.trim()) throw new ApiError(400, "code_required", "Enter a join code");
  const code = normalizeJoinCode(rawCode);
  if (!code) throw new ApiError(400, "invalid_code", "Join codes are 6 letters and numbers");

  const lecture = maybe(
    await adminClient().from("lectures").select(LECTURE_COLUMNS).eq("join_code", code).maybeSingle<LectureRow>(),
  );
  if (!lecture) throw new ApiError(404, "code_not_found", "No lecture found for that code");
  if (lecture.status === "ended") throw new ApiError(410, "lecture_ended", "This lecture has ended");
  if (!isJoinable(lecture.status)) {
    throw new ApiError(409, "lecture_not_open", "This lecture is not open for joining yet");
  }
  return lecture;
}

export function toJoinPreview(lecture: LectureRow): JoinPreview {
  return {
    lectureId: lecture.id,
    title: lecture.title,
    module: lecture.module,
    lecturerName: lecture.lecturer_name,
    status: lecture.status,
  };
}
