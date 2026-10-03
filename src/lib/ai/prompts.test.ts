import { describe, expect, it } from "vitest";
import {
  lecturerInsightPrompt,
  objectivesOutput,
  parseModelJson,
  studentRecapOutput,
  studentRecapPrompt,
  tutorSystemPrompt,
  type LectureContext,
} from "./prompts";

const ctx: LectureContext = {
  title: "Graph Algorithms",
  module: "CS201",
  description: null,
  objectives: ["Explain BFS"],
  slideTexts: [{ slideNumber: 2, text: "Breadth-first search" }],
};

describe("parseModelJson", () => {
  it("parses plain and fenced JSON", () => {
    expect(parseModelJson('{"objectives":["Explain BFS"]}', objectivesOutput).objectives).toEqual(["Explain BFS"]);
    expect(parseModelJson('```json\n{"objectives":["A"]}\n```', objectivesOutput).objectives).toEqual(["A"]);
  });

  it("rejects output that does not match the schema", () => {
    expect(() => parseModelJson('{"objectives":[]}', objectivesOutput)).toThrow();
    expect(() => parseModelJson("not json", objectivesOutput)).toThrow();
    expect(() => parseModelJson('{"summary":"x"}', studentRecapOutput)).toThrow();
  });
});

describe("prompts", () => {
  it("includes lecture context and the current slide in the tutor prompt", () => {
    const prompt = tutorSystemPrompt(ctx, 2);
    expect(prompt).toContain("Graph Algorithms");
    expect(prompt).toContain("Explain BFS");
    expect(prompt).toContain("[Slide 2] Breadth-first search");
    expect(prompt).toContain("slide 2");
  });

  it("describes the student's own activity in the recap prompt", () => {
    const { text } = studentRecapPrompt(ctx, {
      notes: "BFS uses a queue",
      annotations: [{ slideNumber: 2, content: "revisit" }],
      questions: [],
      aiQuestions: ["What is a queue?"],
      confusedSlides: [2],
    });
    expect(text).toContain("BFS uses a queue");
    expect(text).toContain("[Slide 2] revisit");
    expect(text).toContain("What is a queue?");
    expect(text).toContain("confused\": 2");
  });

  it("gives the lecturer prompt aggregate data only", () => {
    const { text } = lecturerInsightPrompt(ctx, {
      participantCount: 12,
      confusion: [{ slideNumber: 2, signalCount: 5, uniqueStudents: 4 }],
      questions: [{ slideNumber: 2, body: "Why a queue?" }],
    });
    expect(text).toContain("Students joined: 12");
    expect(text).toContain("Slide 2: 5 / 4");
    expect(text).toContain("[Slide 2] Why a queue?");
  });
});
