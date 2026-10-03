// Dynamic variables for the ElevenLabs voice agent. Every variable referenced in the agent's
// prompt must be present (and non-empty) or the session fails to start.

export interface VoiceContextInput {
  studentName: string;
  lectureTitle: string;
  module: string | null;
  objectives: string[];
  currentSlide: number | null;
  slideText: string | null;
  confusedSlides: number[];
}

export type VoiceVariables = Record<
  "student_name" | "lecture_title" | "module" | "objectives" | "current_slide" | "slide_text" | "confused_slides",
  string
>;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function buildVoiceVariables(input: VoiceContextInput): VoiceVariables {
  return {
    student_name: clip(input.studentName.trim() || "there", 60),
    lecture_title: clip(input.lectureTitle, 200),
    module: input.module?.trim() || "this course",
    objectives: input.objectives.length ? clip(input.objectives.map((o, i) => `${i + 1}. ${o}`).join(" "), 1500) : "none listed",
    current_slide: input.currentSlide ? String(input.currentSlide) : "none yet (the lecture has not started)",
    slide_text: input.slideText?.trim() ? clip(input.slideText.trim(), 2000) : "no slide text available",
    confused_slides: input.confusedSlides.length ? input.confusedSlides.join(", ") : "none",
  };
}

/** One-sentence description of the current slide, spoken back by the agent's get_current_slide tool. */
export function describeSlide(currentSlide: number | null, slideCount: number, text: string | null): string {
  if (!currentSlide) return "The lecture has not started yet, so there is no slide on screen.";
  const base = `The lecture is on slide ${currentSlide} of ${slideCount}.`;
  return text?.trim() ? `${base} Slide text: ${clip(text.trim(), 2000)}` : `${base} This slide has no text available.`;
}
