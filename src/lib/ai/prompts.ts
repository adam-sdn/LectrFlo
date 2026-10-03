import { z } from "zod";
import type { ConfusionSlideStat } from "@/lib/types";

export interface LectureContext {
  title: string;
  module: string | null;
  description: string | null;
  objectives: string[];
  /** Slide text where available, keyed by slide number. */
  slideTexts: { slideNumber: number; text: string }[];
}

function describeLecture(ctx: LectureContext): string {
  const lines = [`Lecture: ${ctx.title}`];
  if (ctx.module) lines.push(`Module: ${ctx.module}`);
  if (ctx.description) lines.push(`Description: ${ctx.description}`);
  if (ctx.objectives.length) {
    lines.push("Learning objectives:", ...ctx.objectives.map((o, i) => `${i + 1}. ${o}`));
  }
  if (ctx.slideTexts.length) {
    lines.push("Slide text:", ...ctx.slideTexts.map((s) => `[Slide ${s.slideNumber}] ${s.text}`));
  }
  return lines.join("\n");
}

export function tutorSystemPrompt(ctx: LectureContext, currentSlide: number | null): string {
  return [
    "You are Lecture AI, a private tutor for one university student during a lecture.",
    "Answer using the lecture context below. If the question goes beyond the lecture, say so briefly and still help.",
    "Be concise and clear: short paragraphs, examples where they help, no more than about 250 words unless asked.",
    "Never claim to know what other students asked or did.",
    currentSlide ? `The student is currently on slide ${currentSlide}; its image is attached when available.` : "",
    "",
    describeLecture(ctx),
  ]
    .filter(Boolean)
    .join("\n");
}

export function objectivesPrompt(ctx: LectureContext) {
  return {
    system:
      "You extract learning objectives from university lecture slides. Return JSON only, as " +
      '{"objectives": string[]} with 3 to 6 short objectives, each starting with a verb (e.g. "Explain ...").',
    text: describeLecture(ctx),
  };
}

export interface StudentActivity {
  notes: string;
  annotations: { slideNumber: number; content: string }[];
  questions: string[];
  aiQuestions: string[];
  confusedSlides: number[];
}

export function studentRecapPrompt(ctx: LectureContext, activity: StudentActivity) {
  const lines = [
    describeLecture(ctx),
    "",
    "The student's own activity during the lecture:",
    `Notes:\n${activity.notes || "(none)"}`,
    `Slide annotations:\n${activity.annotations.map((a) => `[Slide ${a.slideNumber}] ${a.content}`).join("\n") || "(none)"}`,
    `Questions to the lecturer:\n${activity.questions.join("\n") || "(none)"}`,
    `Questions to Lecture AI:\n${activity.aiQuestions.join("\n") || "(none)"}`,
    `Slides where they pressed "I'm confused": ${activity.confusedSlides.join(", ") || "(none)"}`,
  ];
  return {
    system:
      "You write a personal post-lecture recap for one student. Return JSON only with this shape: " +
      '{"summary": string, "keyConcepts": [{"concept": string, "explanation": string}], ' +
      '"objectivesReview": [{"objective": string, "takeaway": string}], ' +
      '"struggledWith": [{"topic": string, "slideNumber": number | null, "suggestion": string}], ' +
      '"followUp": string[]}. ' +
      "Base struggledWith only on the student's confusion signals and questions; use an empty array if there are none. " +
      "Do not invent activity.",
    text: lines.join("\n"),
  };
}

export interface ClassActivity {
  participantCount: number;
  confusion: ConfusionSlideStat[];
  questions: { slideNumber: number | null; body: string }[];
}

export function lecturerInsightPrompt(ctx: LectureContext, activity: ClassActivity) {
  const lines = [
    describeLecture(ctx),
    "",
    `Students joined: ${activity.participantCount}`,
    "Confusion signals by slide (signals / distinct students):",
    activity.confusion.map((c) => `Slide ${c.slideNumber}: ${c.signalCount} / ${c.uniqueStudents}`).join("\n") ||
      "(none)",
    "Anonymous student questions:",
    activity.questions.map((q) => `${q.slideNumber ? `[Slide ${q.slideNumber}] ` : ""}${q.body}`).join("\n") ||
      "(none)",
  ];
  return {
    system:
      "You write a post-lecture insight report for a university lecturer from aggregate, anonymous class signals. " +
      "Return JSON only with this shape: " +
      '{"summary": string, "confusionHotspots": [{"slideNumber": number, "likelyCause": string, "suggestion": string}], ' +
      '"questionThemes": [{"theme": string, "count": number, "exampleQuestions": string[]}], ' +
      '"recommendations": string[]}. ' +
      "Only list hotspots for slides that received confusion signals. Never identify individual students.",
    text: lines.join("\n"),
  };
}

export const objectivesOutput = z.object({
  objectives: z.array(z.string().trim().min(1).max(500)).min(1).max(10),
});

export const studentRecapOutput = z.object({
  summary: z.string(),
  keyConcepts: z.array(z.object({ concept: z.string(), explanation: z.string() })),
  objectivesReview: z.array(z.object({ objective: z.string(), takeaway: z.string() })),
  struggledWith: z.array(
    z.object({ topic: z.string(), slideNumber: z.number().int().nullable(), suggestion: z.string() }),
  ),
  followUp: z.array(z.string()),
});

export const lecturerInsightOutput = z.object({
  summary: z.string(),
  confusionHotspots: z.array(
    z.object({ slideNumber: z.number().int(), likelyCause: z.string(), suggestion: z.string() }),
  ),
  questionThemes: z.array(
    z.object({ theme: z.string(), count: z.number().int(), exampleQuestions: z.array(z.string()) }),
  ),
  recommendations: z.array(z.string()),
});

/** Parses model output as JSON (tolerating ```json fences) and validates it. */
export function parseModelJson<T extends z.ZodType>(text: string, schema: T): z.infer<T> {
  const unfenced = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return schema.parse(JSON.parse(unfenced));
}
