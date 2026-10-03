import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

export const createLectureSchema = z.object({
  title: z.string().trim().min(1).max(200),
  module: optionalText(200),
  description: optionalText(2000),
});

export const updateLectureSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    module: optionalText(200).optional(),
    description: optionalText(2000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const lifecycleSchema = z.object({ action: z.enum(["open", "start", "end"]) });

export const setSlideSchema = z.object({ slideNumber: z.number().int().min(1) });

export const slideTextSchema = z.object({ textContent: z.string().max(20000).nullable() });

export const objectivesSchema = z.object({
  objectives: z.array(z.string().trim().min(1).max(500)).max(10),
});

export const updateQuestionSchema = z.object({ status: z.enum(["open", "answered", "dismissed"]) });

export const joinSchema = z.object({
  code: z.string().max(20),
  displayName: z.string().trim().min(1).max(60),
});

export const notesSchema = z.object({ content: z.string().max(100000) });

const coordinate = z.number().min(0).max(1).nullish();

export const createAnnotationSchema = z.object({
  slideNumber: z.number().int().min(1),
  content: z.string().trim().min(1).max(5000),
  x: coordinate,
  y: coordinate,
});

export const updateAnnotationSchema = z
  .object({
    content: z.string().trim().min(1).max(5000).optional(),
    x: coordinate,
    y: coordinate,
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const askQuestionSchema = z.object({ body: z.string().trim().min(1).max(1000) });

export const askAiSchema = z.object({ message: z.string().trim().min(1).max(2000) });

export const regenerateSchema = z.object({ regenerate: z.boolean().optional() }).optional();
