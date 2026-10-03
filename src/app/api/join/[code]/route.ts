import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { resolveJoinCode, toJoinPreview } from "@/lib/join";

type Ctx = { params: Promise<{ code: string }> };

/** Previews the lecture behind a join code (used by QR links before the student enters a name). */
export const GET = route<Ctx>(async (_req, { params }) => {
  const lecture = await resolveJoinCode(decodeURIComponent((await params).code));
  return NextResponse.json({ lecture: toJoinPreview(lecture) });
});
