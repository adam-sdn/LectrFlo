import { readFile } from "node:fs/promises";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { buildNotesExport, type NotesExportInput } from "./export";
import type { AiMessage } from "./types";

vi.mock("server-only", () => ({}));

const { renderNotesPdf, wrap } = await import("./notes-pdf");

const input = (extra: Partial<NotesExportInput> = {}): NotesExportInput => ({
  lecture: { title: "Calculus 101 — Differentiation", module: "MATH 101", lecturerName: "Dr Lee", date: "2026-10-03T09:00:00Z" },
  studentName: "Zoë",
  notes: "",
  annotations: [],
  questions: [],
  aiMessages: [],
  ...extra,
});

describe("renderNotesPdf", () => {
  it("renders a one-page PDF for an empty lecture", async () => {
    const bytes = await renderNotesPdf(buildNotesExport(input()));
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Calculus 101 — Differentiation — notes");
  });

  it("paginates a long conversation and copes with symbols, emoji and control characters", async () => {
    const aiMessages: AiMessage[] = [];
    for (let i = 0; i < 40; i++) {
      aiMessages.push(
        { id: `q${i}`, role: "student", content: `Why is d/dx[x³] = 3x²? 🤔 \u0007 (${i})`, slideNumber: 3, status: "complete", createdAt: "" },
        {
          id: `a${i}`,
          role: "assistant",
          content: "By the **power rule**: $\\frac{d}{dx} x^n = n x^{n-1}$, so\n\n- n = 3\n- 3x² ≤ ∞, θ → π\n1. done\twith a tab",
          slideNumber: 3,
          status: "complete",
          createdAt: "",
        },
      );
    }
    const bytes = await renderNotesPdf(
      buildNotesExport(input({ notes: `${"x".repeat(5000)}\n\n- note\nline with 中文`, aiMessages })),
    );
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(3);
    // Fonts are subset, so the file stays small.
    expect(bytes.length).toBeLessThan(400_000);
  });
});

describe("wrap", () => {
  it("wraps on spaces, keeps fonts apart and splits words longer than a line", async () => {
    const doc = await PDFDocument.create();
    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const ink = rgb(0, 0, 0);
    const lines = wrap(
      [
        { text: "alpha beta ", font: regular, color: ink },
        { text: "gamma", font: bold, color: ink },
        { text: " delta " + "w".repeat(40), font: regular, color: ink },
      ],
      10,
      100,
    );
    const text = lines.map((l) => l.segments.map((s) => s.text).join(""));
    expect(text[0]).toBe("alpha beta gamma");
    expect(lines[0].segments.map((s) => s.font)).toEqual([regular, bold]);
    expect(text[1]).toBe("delta");
    expect(text.slice(2).join("")).toBe("w".repeat(40));
    expect(text.length).toBeGreaterThan(3);
    for (const line of lines) expect(line.width).toBeLessThanOrEqual(100);
  });

  it("drops emoji the font can't draw but keeps symbols it can", async () => {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(await readFile("assets/fonts/DejaVuSans.ttf"), { subset: true });
    const lines = wrap([{ text: "done 🎉✓ x² → 中\ttab", font, color: rgb(0, 0, 0) }], 10, 400);
    expect(lines.map((l) => l.segments.map((s) => s.text).join(""))).toEqual(["done ✓ x² → 中 tab"]);
  });

  it("puts a word that is wider than the line on a line of its own", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const ink = rgb(0, 0, 0);
    const lines = wrap([{ text: `hi ${"m".repeat(30)}`, font, color: ink }], 10, 60);
    expect(lines[0].segments.map((s) => s.text).join("")).toBe("hi");
    expect(lines.slice(1).every((l) => /^m+$/.test(l.segments.map((s) => s.text).join("")))).toBe(true);
  });
});
