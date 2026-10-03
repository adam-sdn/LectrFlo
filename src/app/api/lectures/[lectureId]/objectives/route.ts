import { NextResponse } from "next/server";
import { parseBody, route } from "@/lib/api";
import { requireOwnedLecture } from "@/lib/auth";
import { loadObjectives, replaceObjectives } from "@/lib/lectures";
import { objectivesSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ lectureId: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const { lecture } = await requireOwnedLecture(req, (await params).lectureId);
  return NextResponse.json({ objectives: await loadObjectives(lecture.id) });
});

/** Replaces the objective list (lecturer-authored or edited). */
export const PUT = route<Ctx>(async (req, { params }) => {
  const { lecture } = await requireOwnedLecture(req, (await params).lectureId);
  const { objectives } = await parseBody(req, objectivesSchema);
  return NextResponse.json({ objectives: await replaceObjectives(lecture.id, objectives, "lecturer") });
});
