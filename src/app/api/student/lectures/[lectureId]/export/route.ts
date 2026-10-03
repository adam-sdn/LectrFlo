import { route } from "@/lib/api";
import { requireParticipant } from "@/lib/auth";
import { buildNotesExport } from "@/lib/export";
import { renderNotesPdf } from "@/lib/notes-pdf";
import { loadStudentActivity } from "@/lib/student-activity";

type Ctx = { params: Promise<{ lectureId: string }> };

/** Downloads the student's notes, Lecture AI questions and answers, annotations and questions as a PDF. */
export const GET = route<Ctx>(async (_req, { params }) => {
  const { participant, lecture } = await requireParticipant((await params).lectureId);
  const activity = await loadStudentActivity(participant.id);
  const pdf = await renderNotesPdf(
    buildNotesExport({
      lecture: {
        title: lecture.title,
        module: lecture.module,
        lecturerName: lecture.lecturer_name,
        date: lecture.started_at ?? lecture.created_at,
      },
      studentName: participant.display_name,
      notes: activity.notes.content,
      annotations: activity.annotations,
      questions: activity.questions,
      aiMessages: activity.aiMessages,
    }),
  );
  const filename = `${lecture.title.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "lecture"}-notes.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
