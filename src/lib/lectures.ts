import "server-only";
import { check, must } from "@/lib/api";
import { toLectureSummary, toObjective, type LectureRow, type SlideRow } from "@/lib/db";
import { lectureChannel } from "@/lib/realtime";
import { broadcastLecture } from "@/lib/realtime-server";
import { adminClient } from "@/lib/supabase/admin";
import { aggregateConfusion } from "@/lib/confusion";
import type { ConfusionSlideStat, LearningObjective, ObjectiveSource } from "@/lib/types";

const SLIDE_COLUMNS = "id, lecture_id, slide_number, storage_path, mime_type, text_content";

export async function loadSlides(lectureId: string): Promise<SlideRow[]> {
  return must(
    await adminClient()
      .from("lecture_slides")
      .select(SLIDE_COLUMNS)
      .eq("lecture_id", lectureId)
      .order("slide_number")
      .returns<SlideRow[]>(),
  );
}

export async function countSlides(lectureId: string): Promise<number> {
  const { count, error } = await adminClient()
    .from("lecture_slides")
    .select("id", { count: "exact", head: true })
    .eq("lecture_id", lectureId);
  if (error) throw new Error(`Database error: ${error.message}`);
  return count ?? 0;
}

export async function countParticipants(lectureId: string): Promise<number> {
  const { count, error } = await adminClient()
    .from("lecture_participants")
    .select("id", { count: "exact", head: true })
    .eq("lecture_id", lectureId);
  if (error) throw new Error(`Database error: ${error.message}`);
  return count ?? 0;
}

export async function loadObjectives(lectureId: string): Promise<LearningObjective[]> {
  const rows = must(
    await adminClient()
      .from("learning_objectives")
      .select("id, position, text, source")
      .eq("lecture_id", lectureId)
      .order("position")
      .returns<{ id: string; position: number; text: string; source: ObjectiveSource }[]>(),
  );
  return rows.map(toObjective);
}

/** Replaces the lecture's objectives with the given list, in order. */
export async function replaceObjectives(lectureId: string, texts: string[], source: ObjectiveSource) {
  const db = adminClient();
  check(await db.from("learning_objectives").delete().eq("lecture_id", lectureId));
  if (texts.length > 0) {
    check(
      await db
        .from("learning_objectives")
        .insert(texts.map((text, i) => ({ lecture_id: lectureId, position: i + 1, text, source }))),
    );
  }
  await broadcastLecture(lectureChannel(lectureId), "objectives_updated", {});
  return loadObjectives(lectureId);
}

export async function broadcastLectureState(lecture: LectureRow) {
  const summary = toLectureSummary(lecture, await countSlides(lecture.id));
  await broadcastLecture(lectureChannel(lecture.id), "lecture_state", {
    status: summary.status,
    currentSlide: summary.currentSlide,
    slideCount: summary.slideCount,
    startedAt: summary.startedAt,
    endedAt: summary.endedAt,
  });
}

/** Confusion signal counts per slide, optionally restricted to signals since `since`. */
export async function confusionBySlide(lectureId: string, since?: string): Promise<ConfusionSlideStat[]> {
  let query = adminClient()
    .from("confusion_signals")
    .select("slide_number, participant_id")
    .eq("lecture_id", lectureId);
  if (since) query = query.gte("created_at", since);
  const rows = must(await query.returns<{ slide_number: number; participant_id: string }[]>());
  return aggregateConfusion(rows);
}
