import { route } from "@/lib/api";
import { requireParticipant } from "@/lib/auth";
import { formatNotesExport } from "@/lib/export";
import { loadStudentActivity } from "@/lib/student-activity";

type Ctx = { params: Promise<{ lectureId: string }> };

/** Downloads the student's notes, annotations and questions as Markdown. */
export const GET = route<Ctx>(async (_req, { params }) => {
  const { participant, lecture } = await requireParticipant((await params).lectureId);
  const activity = await loadStudentActivity(participant.id);
  const markdown = formatNotesExport(lecture.title, lecture.module, activity);
  const filename = `${lecture.title.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "lecture"}-notes.md`;
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
