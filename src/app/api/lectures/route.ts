import { NextResponse } from "next/server";
import { must, parseBody, route } from "@/lib/api";
import { requireLecturer } from "@/lib/auth";
import { LECTURE_COLUMNS, toLecturerLecture, type LectureRow } from "@/lib/db";
import { generateJoinCode } from "@/lib/join-code";
import { adminClient } from "@/lib/supabase/admin";
import { createLectureSchema } from "@/lib/validation";

export const GET = route(async (req) => {
  const user = await requireLecturer(req);
  const db = adminClient();
  const rows = must(
    await db
      .from("lectures")
      .select(`${LECTURE_COLUMNS}, lecture_slides(count)`)
      .eq("lecturer_id", user.id)
      .order("created_at", { ascending: false })
      .returns<(LectureRow & { lecture_slides: { count: number }[] })[]>(),
  );
  return NextResponse.json({
    lectures: rows.map((r) => toLecturerLecture(r, r.lecture_slides[0]?.count ?? 0)),
  });
});

export const POST = route(async (req) => {
  const user = await requireLecturer(req);
  const input = await parseBody(req, createLectureSchema);
  const lecturerName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null;

  // Retry on the (rare) join code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await adminClient()
      .from("lectures")
      .insert({
        lecturer_id: user.id,
        lecturer_name: lecturerName?.slice(0, 120) ?? null,
        title: input.title,
        module: input.module,
        description: input.description,
        join_code: generateJoinCode(),
      })
      .select(LECTURE_COLUMNS)
      .single<LectureRow>();
    if (!error) return NextResponse.json({ lecture: toLecturerLecture(data, 0) }, { status: 201 });
    if (error.code !== "23505") throw new Error(`Database error: ${error.message}`);
  }
  throw new Error("Could not allocate a unique join code");
});
