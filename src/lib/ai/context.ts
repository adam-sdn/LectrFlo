import "server-only";
import type { LectureContext } from "@/lib/ai/prompts";
import type { LectureRow, SlideRow } from "@/lib/db";
import type { LearningObjective } from "@/lib/types";

export function buildLectureContext(
  lecture: LectureRow,
  objectives: LearningObjective[],
  slides: SlideRow[],
): LectureContext {
  return {
    title: lecture.title,
    module: lecture.module,
    description: lecture.description,
    objectives: objectives.map((o) => o.text),
    slideTexts: slides
      .filter((s) => s.text_content)
      .map((s) => ({ slideNumber: s.slide_number, text: s.text_content as string })),
  };
}
