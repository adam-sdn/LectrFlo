import { describe, expect, it } from "vitest";
import { buildNotesExport, exportTimeZone, pairAiMessages, parseRichText, type NotesExportInput } from "./export";
import type { AiMessage } from "./types";

const ai = (role: AiMessage["role"], content: string, extra: Partial<AiMessage> = {}): AiMessage => ({
  id: `${role}-${content}`,
  role,
  content,
  slideNumber: null,
  status: "complete",
  createdAt: "",
  ...extra,
});

const input = (extra: Partial<NotesExportInput> = {}): NotesExportInput => ({
  lecture: { title: "Graphs", module: "CS201", lecturerName: "Dr Lee", date: "2026-10-03T09:00:00Z" },
  studentName: "Sam",
  notes: "",
  annotations: [],
  questions: [],
  aiMessages: [],
  timeZone: "UTC",
  ...extra,
});

describe("pairAiMessages", () => {
  const pairs = (messages: AiMessage[]) =>
    pairAiMessages(messages).map((p) => [p.question?.content ?? null, p.answer?.content ?? null]);

  it("pairs each question with the reply that followed it", () => {
    expect(
      pairs([
        ai("student", "q1"),
        ai("assistant", "a1"),
        ai("student", "q2", { status: "failed" }),
        ai("student", "q3"),
        ai("assistant", "a3"),
      ]),
    ).toEqual([
      ["q1", "a1"],
      ["q2", null],
      ["q3", "a3"],
    ]);
  });

  it("keeps overlapping requests (two tabs) in order", () => {
    expect(pairs([ai("student", "q1"), ai("student", "q2"), ai("assistant", "a1"), ai("assistant", "a2")])).toEqual([
      ["q1", "a1"],
      ["q2", "a2"],
    ]);
  });

  it("never gives a reply to a question that is still pending or failed", () => {
    expect(
      pairs([
        ai("student", "slow", { status: "pending" }),
        ai("student", "broken", { status: "failed" }),
        ai("student", "q"),
        ai("assistant", "a"),
      ]),
    ).toEqual([
      ["slow", null],
      ["broken", null],
      ["q", "a"],
    ]);
  });

  it("keeps a reply with no question waiting instead of dropping it", () => {
    expect(pairs([ai("assistant", "orphan"), ai("student", "q")])).toEqual([
      [null, "orphan"],
      ["q", null],
    ]);
  });
});

describe("buildNotesExport", () => {
  it("includes Lecture AI questions and answers in order, with readable maths in the answers", () => {
    const doc = buildNotesExport(
      input({
        notes: "Power rule",
        aiMessages: [
          ai("student", "What is $x^2$ differentiated?", { slideNumber: 3 }),
          ai("assistant", "It is $2x$, by the power rule $\\frac{d}{dx} x^n = n x^{n-1}$."),
          ai("student", "And a constant?", { status: "failed" }),
          ai("student", "Still thinking?", { status: "pending" }),
        ],
      }),
    );
    expect(doc.title).toBe("Graphs");
    expect(doc.subtitle).toBe("CS201 · Dr Lee");
    expect(doc.byline).toBe("Notes for Sam · 3 October 2026");
    expect(doc.sections.map((s) => s.heading)).toEqual(["My notes", "Questions to Lecture AI", "Questions to your lecturer"]);
    expect(doc.sections[0].items).toEqual([{ kind: "text", text: "Power rule" }]);
    expect(doc.sections[1].items).toEqual([
      {
        kind: "qa",
        label: "Question 1 · Slide 3",
        question: "What is $x^2$ differentiated?",
        answer: "It is 2x, by the power rule d/dx xⁿ = n xⁿ⁻¹.",
        answered: true,
      },
      { kind: "qa", label: "Question 2", question: "And a constant?", answer: "Lecture AI couldn't answer this question.", answered: false },
      { kind: "qa", label: "Question 3", question: "Still thinking?", answer: "No answer was saved for this question.", answered: false },
    ]);
  });

  it("keeps the student's own notes exactly as typed", () => {
    const doc = buildNotesExport(input({ notes: "Costs $5 and $10\n  2**10 = 1024" }));
    expect(doc.sections[0].items).toEqual([{ kind: "text", text: "Costs $5 and $10\n  2**10 = 1024" }]);
  });

  it("labels a reply without a question", () => {
    const doc = buildNotesExport(input({ aiMessages: [ai("assistant", "Hello")] }));
    expect(doc.sections[1].items).toEqual([{ kind: "qa", label: "Lecture AI reply", question: null, answer: "Hello", answered: true }]);
  });

  it("dates the lecture in the student's time zone", () => {
    const late = { title: "Graphs", module: null, lecturerName: null, date: "2026-10-04T00:30:00Z" };
    expect(buildNotesExport(input({ lecture: late })).byline).toBe("Notes for Sam · 4 October 2026");
    expect(buildNotesExport(input({ lecture: late, timeZone: "America/Chicago" })).byline).toBe("Notes for Sam · 3 October 2026");
  });

  it("groups annotations by slide and tags lecturer questions", () => {
    const doc = buildNotesExport(
      input({
        annotations: [
          { id: "1", slideNumber: 2, content: "first", x: null, y: null, createdAt: "", updatedAt: "" },
          { id: "2", slideNumber: 2, content: "second", x: null, y: null, createdAt: "", updatedAt: "" },
          { id: "3", slideNumber: 5, content: "third", x: null, y: null, createdAt: "", updatedAt: "" },
        ],
        questions: [
          { id: "q", body: "Why?", slideNumber: 2, status: "answered", createdAt: "" },
          { id: "r", body: "How?", slideNumber: null, status: "open", createdAt: "" },
        ],
      }),
    );
    const annotations = doc.sections.find((s) => s.heading === "Slide annotations")!;
    expect(annotations.items).toEqual([
      { kind: "subheading", text: "Slide 2" },
      { kind: "entry", text: "first", meta: null },
      { kind: "entry", text: "second", meta: null },
      { kind: "subheading", text: "Slide 5" },
      { kind: "entry", text: "third", meta: null },
    ]);
    expect(doc.sections.at(-1)!.items).toEqual([
      { kind: "entry", text: "Why?", meta: "Slide 2 · Answered" },
      { kind: "entry", text: "How?", meta: null },
    ]);
  });

  it("shows empty states and leaves out annotations when there are none", () => {
    const doc = buildNotesExport(
      input({ lecture: { title: "Graphs", module: null, lecturerName: null, date: null }, notes: "  \n " }),
    );
    expect(doc.subtitle).toBeNull();
    expect(doc.byline).toBe("Notes for Sam");
    expect(doc.sections.map((s) => [s.heading, s.items.length, s.empty])).toEqual([
      ["My notes", 0, "You didn't write any notes."],
      ["Questions to Lecture AI", 0, "You didn't ask Lecture AI anything."],
      ["Questions to your lecturer", 0, "You didn't ask your lecturer any questions."],
    ]);
  });
});

describe("exportTimeZone", () => {
  it("accepts valid IANA zones and falls back to UTC", () => {
    expect(exportTimeZone("Europe/London")).toBe("Europe/London");
    expect(exportTimeZone("Not/AZone")).toBe("UTC");
    expect(exportTimeZone("")).toBe("UTC");
    expect(exportTimeZone(null)).toBe("UTC");
    expect(exportTimeZone("x".repeat(100))).toBe("UTC");
  });
});

describe("parseRichText", () => {
  it("splits paragraphs, lists, headings and bold text", () => {
    expect(parseRichText("## Rules\nUse the **chain** rule.\n\n- first\n* second\n2) next\n\n\n#hashtag")).toEqual([
      { kind: "paragraph", runs: [{ text: "Rules", bold: true }] },
      {
        kind: "paragraph",
        runs: [
          { text: "Use the ", bold: false },
          { text: "chain", bold: true },
          { text: " rule.", bold: false },
        ],
      },
      { kind: "gap" },
      { kind: "item", marker: "•", runs: [{ text: "first", bold: false }] },
      { kind: "item", marker: "•", runs: [{ text: "second", bold: false }] },
      { kind: "item", marker: "2.", runs: [{ text: "next", bold: false }] },
      { kind: "gap" },
      { kind: "paragraph", runs: [{ text: "#hashtag", bold: false }] },
    ]);
  });

  it("only treats short numbers as list markers", () => {
    expect(parseRichText("2026. A good year")).toEqual([{ kind: "paragraph", runs: [{ text: "2026. A good year", bold: false }] }]);
  });

  it("drops leading and trailing blank lines", () => {
    expect(parseRichText("\n\nhi\n\n")).toEqual([{ kind: "paragraph", runs: [{ text: "hi", bold: false }] }]);
  });
});
