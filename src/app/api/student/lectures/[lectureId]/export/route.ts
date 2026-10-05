import { route } from "@/lib/api";
import { requireParticipant } from "@/lib/auth";
import { buildNotesExport, exportTimeZone } from "@/lib/export";
import { renderNotesPdf } from "@/lib/notes-pdf";
import { loadStudentActivity } from "@/lib/student-activity";

type Ctx = { params: Promise<{ lectureId: string }> };

// Long notes and AI conversations take a few seconds to lay out; fits every Vercel plan.
export const maxDuration = 60;

/**
 * Downloads the student's notes, Lecture AI questions and answers, annotations and questions as a PDF.
 * `?tz=` (an IANA time zone from the browser) dates the lecture in the student's time zone.
 */
export const GET = route<Ctx>(async (req, { params }) => {
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
      timeZone: exportTimeZone(new URL(req.url).searchParams.get("tz")),
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
