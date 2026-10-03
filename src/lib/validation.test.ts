import { describe, expect, it } from "vitest";
import { formatNotesExport } from "./export";
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

describe("formatNotesExport", () => {
  it("groups annotations by slide", () => {
    const md = formatNotesExport("Graphs", "CS201", {
      notes: { content: "My notes", updatedAt: null },
      annotations: [
        { id: "1", slideNumber: 2, content: "first", x: null, y: null, createdAt: "", updatedAt: "" },
        { id: "2", slideNumber: 2, content: "second", x: null, y: null, createdAt: "", updatedAt: "" },
        { id: "3", slideNumber: 5, content: "third", x: null, y: null, createdAt: "", updatedAt: "" },
      ],
      questions: [{ id: "q", body: "Why?", slideNumber: 2, status: "answered", createdAt: "" }],
    });
    expect(md).toContain("# Graphs");
    expect(md).toContain("My notes");
    expect(md.match(/### Slide 2/g)).toHaveLength(1);
    expect(md).toContain("### Slide 5");
    expect(md).toContain("- (Slide 2) Why? — answered");
  });

  it("handles an empty lecture", () => {
    const md = formatNotesExport("Graphs", null, {
      notes: { content: "", updatedAt: null },
      annotations: [],
      questions: [],
    });
    expect(md).toContain("_No notes._");
    expect(md).toContain("_No annotations._");
    expect(md).toContain("_No questions._");
  });
});
