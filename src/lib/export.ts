import { plainMath } from "@/lib/client/plain-math";
import type { AiMessage, Annotation, StudentQuestion } from "@/lib/types";

/** A student's downloadable lecture notes, independent of the file format they are rendered to. */
export interface NotesExport {
  title: string;
  subtitle: string | null;
  byline: string;
  sections: ExportSection[];
}

export interface ExportSection {
  heading: string;
  /** Shown instead of the items when there are none. */
  empty: string;
  items: ExportItem[];
}

export type ExportItem =
  /** Free text with light Markdown: paragraphs, "-" / "1." lists and **bold**. */
  | { kind: "text"; text: string }
  | { kind: "subheading"; text: string }
  | { kind: "entry"; text: string; meta: string | null }
  | { kind: "qa"; label: string; question: string; answer: string; answered: boolean };

export interface NotesExportInput {
  lecture: { title: string; module: string | null; lecturerName: string | null; date: string | null };
  studentName: string;
  notes: string;
  annotations: Annotation[];
  questions: StudentQuestion[];
  /** The student's whole Lecture AI conversation, oldest first. */
  aiMessages: AiMessage[];
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Pairs each question to Lecture AI with the reply that followed it. */
export function pairAiMessages(messages: AiMessage[]): { question: AiMessage; answer: AiMessage | null }[] {
  const pairs: { question: AiMessage; answer: AiMessage | null }[] = [];
  for (const message of messages) {
    if (message.role === "student") pairs.push({ question: message, answer: null });
    else if (pairs.length && !pairs[pairs.length - 1].answer) pairs[pairs.length - 1].answer = message;
  }
  return pairs;
}

export function buildNotesExport(input: NotesExportInput): NotesExport {
  const { lecture } = input;
  const date = lecture.date ? dateFormat.format(new Date(lecture.date)) : null;

  const qa: ExportItem[] = pairAiMessages(input.aiMessages).map(({ question, answer }, i) => ({
    kind: "qa",
    label: [`Question ${i + 1}`, question.slideNumber ? `Slide ${question.slideNumber}` : null].filter(Boolean).join(" · "),
    question: plainMath(question.content),
    answer: answer
      ? plainMath(answer.content)
      : question.status === "failed"
        ? "Lecture AI couldn't answer this question."
        : "No answer was saved for this question.",
    answered: Boolean(answer),
  }));

  const annotations: ExportItem[] = [];
  let slide: number | null = null;
  for (const a of input.annotations) {
    if (a.slideNumber !== slide) {
      slide = a.slideNumber;
      annotations.push({ kind: "subheading", text: `Slide ${slide}` });
    }
    annotations.push({ kind: "entry", text: a.content, meta: null });
  }

  const sections: ExportSection[] = [
    {
      heading: "My notes",
      empty: "You didn't write any notes.",
      items: input.notes.trim() ? [{ kind: "text", text: input.notes }] : [],
    },
    { heading: "Questions to Lecture AI", empty: "You didn't ask Lecture AI anything.", items: qa },
  ];
  // Annotations can only be added through the API, so leave the section out rather than show it empty.
  if (annotations.length) sections.push({ heading: "Slide annotations", empty: "", items: annotations });
  sections.push({
    heading: "Questions to your lecturer",
    empty: "You didn't ask your lecturer any questions.",
    items: input.questions.map((q) => ({
      kind: "entry",
      text: q.body,
      meta: [q.slideNumber ? `Slide ${q.slideNumber}` : null, q.status === "answered" ? "Answered" : null]
        .filter(Boolean)
        .join(" · ") || null,
    })),
  });

  return {
    title: lecture.title,
    subtitle: [lecture.module, lecture.lecturerName].filter(Boolean).join(" · ") || null,
    byline: [`Notes for ${input.studentName}`, date].filter(Boolean).join(" · "),
    sections,
  };
}

export interface TextRun {
  text: string;
  bold: boolean;
}

export type RichBlock =
  | { kind: "paragraph"; runs: TextRun[] }
  | { kind: "item"; marker: string; runs: TextRun[] }
  | { kind: "gap" };

function runs(text: string, bold = false): TextRun[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("**") && part.endsWith("**") && part.length > 4
        ? { text: part.slice(2, -2), bold: true }
        : { text: part, bold },
    );
}

/** Splits free text into paragraphs and list items, matching how Lecture AI answers are shown on screen. */
export function parseRichText(text: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^(\d+)[.)]\s+(.*)$/);
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (!line) {
      if (blocks.length && blocks[blocks.length - 1].kind !== "gap") blocks.push({ kind: "gap" });
    } else if (bullet) blocks.push({ kind: "item", marker: "•", runs: runs(bullet[1]) });
    else if (numbered) blocks.push({ kind: "item", marker: `${numbered[1]}.`, runs: runs(numbered[2]) });
    else if (heading) blocks.push({ kind: "paragraph", runs: runs(heading[1], true) });
    else blocks.push({ kind: "paragraph", runs: runs(line) });
  }
  if (blocks[blocks.length - 1]?.kind === "gap") blocks.pop();
  return blocks;
}
