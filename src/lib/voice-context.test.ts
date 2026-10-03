import { describe, expect, it } from "vitest";
import { buildVoiceVariables, describeSlide } from "./voice-context";

describe("buildVoiceVariables", () => {
  it("fills every variable the agent prompt uses, with fallbacks", () => {
    const vars = buildVoiceVariables({
      studentName: " ",
      lectureTitle: "Calculus 101",
      module: null,
      objectives: [],
      currentSlide: null,
      slideText: null,
      confusedSlides: [],
    });
    expect(Object.keys(vars).sort()).toEqual(
      ["confused_slides", "current_slide", "lecture_title", "module", "objectives", "slide_text", "student_name"].sort(),
    );
    for (const value of Object.values(vars)) expect(value.length).toBeGreaterThan(0);
    expect(vars.student_name).toBe("there");
    expect(vars.confused_slides).toBe("none");
  });

  it("formats lecture context", () => {
    const vars = buildVoiceVariables({
      studentName: "Sam",
      lectureTitle: "Calculus 101",
      module: "MATH 101",
      objectives: ["Explain derivatives", "Use the power rule"],
      currentSlide: 3,
      slideText: "Limit definition",
      confusedSlides: [2, 3],
    });
    expect(vars.objectives).toBe("1. Explain derivatives 2. Use the power rule");
    expect(vars.current_slide).toBe("3");
    expect(vars.confused_slides).toBe("2, 3");
  });
});

describe("describeSlide", () => {
  it("describes the slide state", () => {
    expect(describeSlide(null, 6, null)).toContain("not started");
    expect(describeSlide(3, 6, "Power rule")).toBe("The lecture is on slide 3 of 6. Slide text: Power rule");
    expect(describeSlide(3, 6, "")).toContain("no text");
  });
});
