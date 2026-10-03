import { NextResponse } from "next/server";
import { check, must, parseBody, route } from "@/lib/api";
import { requireOwnedLecture } from "@/lib/auth";
import { LECTURE_COLUMNS, toLecturerLecture, type LectureRow, type ParticipantRow } from "@/lib/db";
import { loadObjectives, loadSlides } from "@/lib/lectures";
import { removeSlideImages, signSlides } from "@/lib/storage";
import { adminClient } from "@/lib/supabase/admin";
import type { LecturerLectureDetail } from "@/lib/types";
import { updateLectureSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ lectureId: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const { lecture } = await requireOwnedLecture(req, (await params).lectureId);
  const [slideRows, objectives, participants] = await Promise.all([
    loadSlides(lecture.id),
    loadObjectives(lecture.id),
    adminClient()
      .from("lecture_participants")
      .select("display_name, joined_at")
      .eq("lecture_id", lecture.id)
      .order("joined_at")
      .returns<Pick<ParticipantRow, "display_name" | "joined_at">[]>()
      .then(must),
  ]);
  const detail: LecturerLectureDetail = {
    ...toLecturerLecture(lecture, slideRows.length),
    slides: await signSlides(slideRows),
    objectives,
    participantCount: participants.length,
    participants: participants.map((p) => ({ displayName: p.display_name, joinedAt: p.joined_at })),
  };
  return NextResponse.json({ lecture: detail });
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { lecture } = await requireOwnedLecture(req, (await params).lectureId);
  const input = await parseBody(req, updateLectureSchema);
  const updated = must(
    await adminClient()
      .from("lectures")
      .update(input)
      .eq("id", lecture.id)
      .select(LECTURE_COLUMNS)
      .single<LectureRow>(),
  );
  const slideCount = (await loadSlides(lecture.id)).length;
  return NextResponse.json({ lecture: toLecturerLecture(updated, slideCount) });
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const { lecture } = await requireOwnedLecture(req, (await params).lectureId);
  const slides = await loadSlides(lecture.id);
  check(await adminClient().from("lectures").delete().eq("id", lecture.id));
  await removeSlideImages(slides.map((s) => s.storage_path));
  return new NextResponse(null, { status: 204 });
});
