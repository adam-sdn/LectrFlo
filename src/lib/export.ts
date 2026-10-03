import type { Annotation, StudentNotes, StudentQuestion } from "@/lib/types";

export function formatNotesExport(
  title: string,
  module: string | null,
  activity: { notes: StudentNotes; annotations: Annotation[]; questions: StudentQuestion[] },
): string {
  const lines = [`# ${title}`];
  if (module) lines.push(`_${module}_`);
  lines.push("", "## Notes", "", activity.notes.content.trim() || "_No notes._", "");

  lines.push("## Slide annotations", "");
  if (activity.annotations.length === 0) lines.push("_No annotations._", "");
  let slide: number | null = null;
  for (const a of activity.annotations) {
    if (a.slideNumber !== slide) {
      slide = a.slideNumber;
      lines.push(`### Slide ${slide}`, "");
    }
    lines.push(`- ${a.content.replace(/\n/g, "\n  ")}`);
  }
  if (activity.annotations.length) lines.push("");

  lines.push("## My questions to the lecturer", "");
  if (activity.questions.length === 0) lines.push("_No questions._");
  for (const q of activity.questions) {
    lines.push(`- ${q.slideNumber ? `(Slide ${q.slideNumber}) ` : ""}${q.body}${q.status === "answered" ? " — answered" : ""}`);
  }
  return lines.join("\n") + "\n";
}
