import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ApiError, check, must, route } from "@/lib/api";
import { requireOwnedLecture, requireStatus } from "@/lib/auth";
import { LECTURE_COLUMNS, type LectureRow } from "@/lib/db";
import { broadcastLectureState, loadSlides } from "@/lib/lectures";
import { MAX_SLIDE_BYTES, MAX_SLIDES, SLIDE_MIME_TYPES } from "@/lib/limits";
import { lectureChannel } from "@/lib/realtime";
import { broadcastLecture } from "@/lib/realtime-server";
import { removeSlideImages, signSlides, uploadSlideImage } from "@/lib/storage";
import { adminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ lectureId: string }> };

const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export const GET = route<Ctx>(async (req, { params }) => {
  const { lecture } = await requireOwnedLecture(req, (await params).lectureId);
  return NextResponse.json({ slides: await signSlides(await loadSlides(lecture.id)) });
});

/** Appends slides from multipart form field `files` (one image per slide, in order). */
export const POST = route<Ctx>(async (req, { params }) => {
  const { lecture } = await requireOwnedLecture(req, (await params).lectureId);
  requireStatus(lecture, ["draft", "lobby", "live"], "upload slides");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "invalid_form", "Send slides as multipart/form-data in the `files` field");
  }
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) throw new ApiError(400, "no_files", "Attach at least one slide image");
  for (const file of files) {
    if (!(SLIDE_MIME_TYPES as readonly string[]).includes(file.type)) {
      throw new ApiError(415, "unsupported_type", `${file.name}: slides must be PNG, JPEG or WebP images`);
    }
    if (file.size > MAX_SLIDE_BYTES) throw new ApiError(413, "file_too_large", `${file.name} is larger than 10 MB`);
  }

  const existing = await loadSlides(lecture.id);
  if (existing.length + files.length > MAX_SLIDES) {
    throw new ApiError(400, "too_many_slides", `A lecture can have at most ${MAX_SLIDES} slides`);
  }

  const start = existing.reduce((max, s) => Math.max(max, s.slide_number), 0) + 1;
  const rows = files.map((file, i) => ({
    lecture_id: lecture.id,
    slide_number: start + i,
    storage_path: `${lecture.id}/${randomUUID()}.${EXTENSIONS[file.type]}`,
    mime_type: file.type,
  }));

  const uploaded: string[] = [];
  try {
    for (const [i, file] of files.entries()) {
      await uploadSlideImage(rows[i].storage_path, file);
      uploaded.push(rows[i].storage_path);
    }
    const { error } = await adminClient().from("lecture_slides").insert(rows);
    if (error?.code === "23505") {
      throw new ApiError(409, "upload_conflict", "Another upload is in progress. Try again.");
    }
    if (error) throw new Error(`Database error: ${error.message}`);
  } catch (err) {
    await removeSlideImages(uploaded);
    throw err;
  }

  const slides = await loadSlides(lecture.id);
  await broadcastLecture(lectureChannel(lecture.id), "slides_updated", { slideCount: slides.length });
  return NextResponse.json({ slides: await signSlides(slides) }, { status: 201 });
});

/** Removes all slides so the deck can be re-uploaded. Not allowed once the lecture is live. */
export const DELETE = route<Ctx>(async (req, { params }) => {
  const { lecture } = await requireOwnedLecture(req, (await params).lectureId);
  requireStatus(lecture, ["draft", "lobby"], "remove slides");
  const slides = await loadSlides(lecture.id);
  check(await adminClient().from("lecture_slides").delete().eq("lecture_id", lecture.id));
  await removeSlideImages(slides.map((s) => s.storage_path));
  const updated = must(
    await adminClient().from("lectures").update({ current_slide: 1 }).eq("id", lecture.id).select(LECTURE_COLUMNS).single<LectureRow>(),
  );
  await broadcastLecture(lectureChannel(lecture.id), "slides_updated", { slideCount: 0 });
  await broadcastLectureState(updated);
  return new NextResponse(null, { status: 204 });
});
