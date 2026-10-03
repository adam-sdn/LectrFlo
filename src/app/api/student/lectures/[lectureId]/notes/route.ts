import { NextResponse } from "next/server";
import { maybe, must, parseBody, route } from "@/lib/api";
import { requireParticipant } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import type { StudentNotes } from "@/lib/types";
import { notesSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ lectureId: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { participant } = await requireParticipant((await params).lectureId);
  const row = maybe(
    await adminClient()
      .from("student_notes")
      .select("content, updated_at")
      .eq("participant_id", participant.id)
      .maybeSingle<{ content: string; updated_at: string }>(),
  );
  const notes: StudentNotes = { content: row?.content ?? "", updatedAt: row?.updated_at ?? null };
  return NextResponse.json({ notes });
});

/** Saves the full notes document (last write wins). Allowed during and after the lecture. */
export const PUT = route<Ctx>(async (req, { params }) => {
  const { participant, lecture } = await requireParticipant((await params).lectureId);
  const { content } = await parseBody(req, notesSchema);
  const row = must(
    await adminClient()
      .from("student_notes")
      .upsert(
        { lecture_id: lecture.id, participant_id: participant.id, content },
        { onConflict: "participant_id" },
      )
      .select("content, updated_at")
      .single<{ content: string; updated_at: string }>(),
  );
  const notes: StudentNotes = { content: row.content, updatedAt: row.updated_at };
  return NextResponse.json({ notes });
});
