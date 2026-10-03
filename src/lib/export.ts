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
  /** The student's own text, printed exactly as typed (line breaks and indentation kept, no Markdown). */
  | { kind: "text"; text: string }
  | { kind: "subheading"; text: string }
  | { kind: "entry"; text: string; meta: string | null }
  /** A Lecture AI exchange. `answer` uses light Markdown: paragraphs, "-" / "1." lists and **bold**. */
  | { kind: "qa"; label: string; question: string | null; answer: string; answered: boolean };

export interface NotesExportInput {
  lecture: { title: string; module: string | null; lecturerName: string | null; date: string | null };
  studentName: string;
  notes: string;
  annotations: Annotation[];
  questions: StudentQuestion[];
  /** The student's whole Lecture AI conversation, oldest first. */
  aiMessages: AiMessage[];
  /** IANA time zone for the lecture date (see `exportTimeZone`). */
  timeZone: string;
}

/** The student's time zone if the browser sent a valid one, so the lecture date isn't a day off. */
export function exportTimeZone(requested: string | null): string {
  if (!requested || requested.length > 64) return "UTC";
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: requested }).resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

type AiPair = { question: AiMessage | null; answer: AiMessage | null };

/**
 * Pairs questions to Lecture AI with their replies. Nothing links a reply to its question, but a reply is
 * saved just after its question is marked complete, so each reply goes to the oldest completed question
 * still waiting. That keeps overlapping requests (two tabs) in order. Failed and still-pending questions
 * never take a reply, and a reply with no question waiting is kept on its own rather than dropped.
 */
export function pairAiMessages(messages: AiMessage[]): AiPair[] {
  const pairs: AiPair[] = [];
  const waiting: AiPair[] = [];
  for (const message of messages) {
    if (message.role === "student") {
      const pair: AiPair = { question: message, answer: null };
      pairs.push(pair);
      if (message.status === "complete") waiting.push(pair);
    } else {
      const pair = waiting.shift();
      if (pair) pair.answer = message;
      else pairs.push({ question: null, answer: message });
    }
  }
  return pairs;
}

export function buildNotesExport(input: NotesExportInput): NotesExport {
  const { lecture } = input;
  const date = lecture.date
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: input.timeZone }).format(
        new Date(lecture.date),
      )
    : null;

  let asked = 0;
  const qa: ExportItem[] = pairAiMessages(input.aiMessages).map(({ question, answer }) => ({
    kind: "qa",
    label: question
      ? [`Question ${++asked}`, question.slideNumber ? `Slide ${question.slideNumber}` : null].filter(Boolean).join(" · ")
      : "Lecture AI reply",
    // The student's question is shown as they typed it; only Lecture AI's LaTeX is made readable, as on screen.
    question: question?.content ?? null,
    answer: answer
      ? plainMath(answer.content)
      : question?.status === "failed"
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
    const numbered = line.match(/^(\d{1,3})[.)]\s+(.*)$/);
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
