import { NextResponse } from "next/server";
import { ApiError, route } from "@/lib/api";
import { buildLectureContext } from "@/lib/ai/context";
import { objectivesOutput, objectivesPrompt, parseModelJson } from "@/lib/ai/prompts";
import { AiProviderError, requireAiProvider, type AiPart } from "@/lib/ai/provider";
import { requireOwnedLecture } from "@/lib/auth";
import { loadSlides, replaceObjectives } from "@/lib/lectures";
import { downloadSlideImage } from "@/lib/storage";

type Ctx = { params: Promise<{ lectureId: string }> };

// AI calls can take a while; fits every Vercel plan.
export const maxDuration = 60;

const MAX_IMAGE_SLIDES = 12;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

/** Extracts learning objectives from the slides with AI and replaces the current list. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { lecture } = await requireOwnedLecture(req, (await params).lectureId);
  const provider = requireAiProvider();
  const slides = await loadSlides(lecture.id);
  if (slides.length === 0) throw new ApiError(400, "no_slides", "Upload slides before generating objectives");

  const ctx = buildLectureContext(lecture, [], slides);
  const prompt = objectivesPrompt(ctx);
  const parts: AiPart[] = [{ text: prompt.text }];

  // Without slide text, send the first slide images so the model can read them.
  if (ctx.slideTexts.length === 0) {
    let bytes = 0;
    for (const slide of slides.slice(0, MAX_IMAGE_SLIDES)) {
      const image = await downloadSlideImage(slide.storage_path);
      if (!image) continue;
      bytes += image.data.length;
      if (bytes > MAX_IMAGE_BYTES) break;
      parts.push({ text: `[Slide ${slide.slide_number}]` }, { image });
    }
  }

  let objectives: string[];
  try {
    const text = await provider.generate({ system: prompt.system, parts, json: true });
    objectives = parseModelJson(text, objectivesOutput).objectives;
  } catch (err) {
    console.error("Objective generation failed", err);
    const message = err instanceof AiProviderError ? "Lecture AI is unavailable" : "Lecture AI returned an invalid response";
    throw new ApiError(502, "ai_failed", `${message}. Try again.`);
  }

  return NextResponse.json({ objectives: await replaceObjectives(lecture.id, objectives, "ai") });
});
