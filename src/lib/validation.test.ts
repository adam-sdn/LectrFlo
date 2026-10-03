import { describe, expect, it } from "vitest";
import { createAnnotationSchema, createLectureSchema, joinSchema, updateLectureSchema } from "./validation";

describe("validation", () => {
  it("trims lecture fields and turns blanks into null", () => {
    expect(createLectureSchema.parse({ title: "  Intro  ", module: "  " })).toEqual({
      title: "Intro",
      module: null,
      description: null,
    });
    expect(createLectureSchema.safeParse({ title: "   " }).success).toBe(false);
  });

  it("requires at least one field when updating a lecture", () => {
    expect(updateLectureSchema.safeParse({}).success).toBe(false);
    expect(updateLectureSchema.safeParse({ title: "New" }).success).toBe(true);
  });

  it("requires a display name to join", () => {
    expect(joinSchema.safeParse({ code: "ABC234", displayName: " " }).success).toBe(false);
    expect(joinSchema.safeParse({ code: "ABC234", displayName: "Sam" }).success).toBe(true);
  });

  it("bounds annotation pin coordinates", () => {
    expect(createAnnotationSchema.safeParse({ slideNumber: 1, content: "x", x: 0.5, y: 0.5 }).success).toBe(true);
    expect(createAnnotationSchema.safeParse({ slideNumber: 1, content: "x", x: 1.5 }).success).toBe(false);
    expect(createAnnotationSchema.safeParse({ slideNumber: 0, content: "x" }).success).toBe(false);
  });
});
