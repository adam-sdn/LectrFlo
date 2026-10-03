import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { parseRichText, type ExportItem, type NotesExport } from "@/lib/export";

// A4, in points.
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 56;
const MARGIN_TOP = 64;
const MARGIN_BOTTOM = 64;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN_X;
const ANSWER_INDENT = 14;
const BAR_WIDTH = 1.5;
const BODY = { size: 10.5, leading: 15.5 };

// The app's paper-and-ink palette.
const INK = rgb(27 / 255, 24 / 255, 20 / 255);
const MUTED = rgb(107 / 255, 100 / 255, 89 / 255);
const NAVY = rgb(31 / 255, 45 / 255, 82 / 255);
const BRASS = rgb(168 / 255, 128 / 255, 58 / 255);
const RULE = rgb(226 / 255, 221 / 255, 211 / 255);

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  display: PDFFont;
}

interface Segment {
  text: string;
  font: PDFFont;
  color: RGB;
}

interface Line {
  segments: Segment[];
  width: number;
}

interface TextOptions {
  size: number;
  leading: number;
  x?: number;
  width?: number;
  /** Draws a vertical bar at the left margin beside every line (used for Lecture AI answers). */
  bar?: RGB;
  /** List marker hung to the left of the first line. */
  marker?: Segment;
}

let fontFiles: Promise<Buffer[]> | null = null;

// DejaVu covers the maths symbols, Greek letters and accented names the standard PDF fonts can't encode.
function loadFontFiles() {
  fontFiles ??= Promise.all([
    readFile(path.join(process.cwd(), "assets/fonts/DejaVuSans.ttf")),
    readFile(path.join(process.cwd(), "assets/fonts/DejaVuSans-Bold.ttf")),
    readFile(path.join(process.cwd(), "assets/fonts/DejaVuSerif-Bold.ttf")),
  ]).catch((err: unknown) => {
    fontFiles = null;
    throw err;
  });
  return fontFiles;
}

const characterSets = new WeakMap<PDFFont, Set<number>>();

/**
 * Drops what the font can't draw cleanly: control characters, and emoji it has no glyph for (they would
 * print as empty boxes). Tabs become spaces. Other missing characters still print as a box, so they stay visible.
 */
function clean(text: string, font: PDFFont): string {
  let supported = characterSets.get(font);
  if (!supported) characterSets.set(font, (supported = new Set(font.getCharacterSet())));
  const known = supported;
  return text
    .replace(/\t/g, "    ")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}‍️]/gu, (char) =>
      known.has(char.codePointAt(0)!) ? char : "",
    );
}

/** Word-wraps mixed-font text to `maxWidth`, splitting words that are wider than a whole line. */
export function wrap(pieces: Segment[], size: number, maxWidth: number): Line[] {
  const lines: Line[] = [];
  let line: Line = { segments: [], width: 0 };
  let space: Segment | null = null;

  const append = (seg: Segment, width: number) => {
    const last = line.segments[line.segments.length - 1];
    if (last && last.font === seg.font && last.color === seg.color) last.text += seg.text;
    else line.segments.push({ ...seg });
    line.width += width;
  };
  const breakLine = () => {
    lines.push(line);
    line = { segments: [], width: 0 };
  };

  for (const piece of pieces) {
    const measure = (text: string) => piece.font.widthOfTextAtSize(text, size);
    for (const token of clean(piece.text, piece.font).split(/(\s+)/)) {
      if (!token) continue;
      if (/^\s+$/.test(token)) {
        if (line.segments.length) space = { ...piece, text: " " };
        continue;
      }
      let word = token;
      let wordWidth = measure(word);
      const spaceWidth = space ? space.font.widthOfTextAtSize(" ", size) : 0;
      if (line.segments.length && line.width + spaceWidth + wordWidth > maxWidth) breakLine();
      else if (space) append(space, spaceWidth);
      space = null;

      while (wordWidth > maxWidth - line.width) {
        const chars = Array.from(word);
        let fitted = 0;
        let fittedWidth = 0;
        for (const char of chars) {
          const w = measure(char);
          if (fittedWidth + w > maxWidth - line.width && (fitted > 0 || line.segments.length)) break;
          fitted++;
          fittedWidth += w;
        }
        if (fitted === 0) {
          breakLine();
          continue;
        }
        if (fitted === chars.length) break;
        append({ ...piece, text: chars.slice(0, fitted).join("") }, fittedWidth);
        breakLine();
        word = chars.slice(fitted).join("");
        wordWidth = measure(word);
      }
      append({ ...piece, text: word }, wordWidth);
    }
  }
  if (line.segments.length) lines.push(line);
  return lines;
}

function truncate(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const flat = clean(text, font).replace(/\s+/g, " ");
  if (font.widthOfTextAtSize(flat, size) <= maxWidth) return flat;
  const chars = Array.from(flat);
  while (chars.length && font.widthOfTextAtSize(`${chars.join("")}…`, size) > maxWidth) chars.pop();
  return `${chars.join("").trimEnd()}…`;
}

class PdfWriter {
  private page!: PDFPage;
  private y = 0;

  constructor(
    private readonly doc: PDFDocument,
    private readonly fonts: Fonts,
  ) {
    this.newPage();
  }

  private newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN_TOP;
  }

  private get atTop() {
    return this.y === PAGE_HEIGHT - MARGIN_TOP;
  }

  /** Moves to a new page unless `height` more points fit on this one. */
  private ensure(height: number) {
    if (this.y - height < MARGIN_BOTTOM && !this.atTop) this.newPage();
  }

  /** Vertical space (never onto a new page), continuing an answer's bar through it. */
  private gap(points: number, bar?: RGB) {
    const next = Math.max(MARGIN_BOTTOM, this.y - points);
    if (bar && next < this.y && !this.atTop) {
      this.page.drawRectangle({ x: MARGIN_X, y: next, width: BAR_WIDTH, height: this.y - next, color: bar });
    }
    this.y = next;
  }

  private text(pieces: Segment[], o: TextOptions) {
    const x = o.x ?? MARGIN_X;
    const indent = o.marker ? Math.max(14, o.marker.font.widthOfTextAtSize(o.marker.text, o.size) + 6) : 0;
    wrap(pieces, o.size, (o.width ?? CONTENT_WIDTH) - indent).forEach((line, i) => {
      this.ensure(o.leading);
      const baseline = this.y - o.size;
      if (o.bar) {
        this.page.drawRectangle({ x: MARGIN_X, y: this.y - o.leading, width: BAR_WIDTH, height: o.leading, color: o.bar });
      }
      if (i === 0 && o.marker) {
        this.page.drawText(o.marker.text, { x, y: baseline, size: o.size, font: o.marker.font, color: o.marker.color });
      }
      let cursor = x + indent;
      for (const seg of line.segments) {
        this.page.drawText(seg.text, { x: cursor, y: baseline, size: o.size, font: seg.font, color: seg.color });
        cursor += seg.font.widthOfTextAtSize(seg.text, o.size);
      }
      this.y -= o.leading;
    });
  }

  private rich(text: string, o: { x?: number; width?: number; color: RGB; bar?: RGB }) {
    parseRichText(text).forEach((block, i) => {
      if (block.kind === "gap") return this.gap(6, o.bar);
      if (i > 0) this.gap(3, o.bar);
      const pieces = block.runs.map((r) => ({ text: r.text, font: r.bold ? this.fonts.bold : this.fonts.regular, color: o.color }));
      const marker = block.kind === "item" ? { text: block.marker, font: this.fonts.regular, color: o.color } : undefined;
      this.text(pieces, { ...BODY, x: o.x, width: o.width, bar: o.bar, marker });
    });
  }

  header(notes: NotesExport) {
    const { regular, bold, display } = this.fonts;
    this.text([{ text: "LECTRFLO · LECTURE NOTES", font: bold, color: BRASS }], { size: 8, leading: 18 });
    this.text([{ text: notes.title, font: display, color: NAVY }], { size: 24, leading: 30 });
    if (notes.subtitle) this.text([{ text: notes.subtitle, font: regular, color: MUTED }], { size: 11, leading: 17 });
    this.text([{ text: notes.byline, font: regular, color: MUTED }], { size: 10, leading: 15 });
    this.gap(10);
    this.page.drawRectangle({ x: MARGIN_X, y: this.y - 2.5, width: 40, height: 2.5, color: BRASS });
    this.gap(14);
  }

  heading(text: string) {
    // Keep the heading with at least the first lines of its section.
    this.ensure(24 + 12 + 3 * BODY.leading);
    if (!this.atTop) this.gap(16);
    this.text([{ text, font: this.fonts.display, color: NAVY }], { size: 15, leading: 20 });
    this.page.drawLine({
      start: { x: MARGIN_X, y: this.y - 2 },
      end: { x: MARGIN_X + CONTENT_WIDTH, y: this.y - 2 },
      thickness: 0.75,
      color: RULE,
    });
    this.gap(12);
  }

  empty(text: string) {
    this.text([{ text, font: this.fonts.regular, color: MUTED }], BODY);
  }

  item(item: ExportItem) {
    const { regular, bold } = this.fonts;
    switch (item.kind) {
      case "text":
        return this.rich(item.text, { color: INK });
      case "subheading":
        this.ensure(18 + 2 * BODY.leading);
        if (!this.atTop) this.gap(6);
        return this.text([{ text: item.text, font: bold, color: NAVY }], { size: 10, leading: 16 });
      case "entry": {
        const pieces: Segment[] = [{ text: item.text, font: regular, color: INK }];
        if (item.meta) pieces.push({ text: ` — ${item.meta}`, font: regular, color: MUTED });
        this.text(pieces, { ...BODY, marker: { text: "•", font: regular, color: BRASS } });
        return this.gap(3);
      }
      case "qa":
        // Keep the label, the question and the start of the answer together.
        this.ensure(13 + 16 + 4 + 2 * BODY.leading);
        this.text([{ text: item.label.toUpperCase(), font: bold, color: BRASS }], { size: 8, leading: 13 });
        this.text([{ text: item.question, font: bold, color: INK }], { size: 11, leading: 16 });
        this.gap(4);
        this.rich(item.answer, {
          x: MARGIN_X + ANSWER_INDENT,
          width: CONTENT_WIDTH - ANSWER_INDENT,
          color: item.answered ? INK : MUTED,
          bar: item.answered ? NAVY : RULE,
        });
        return this.gap(16);
    }
  }

  footers(title: string) {
    const { regular } = this.fonts;
    const pages = this.doc.getPages();
    pages.forEach((page, i) => {
      const number = `Page ${i + 1} of ${pages.length}`;
      const numberWidth = regular.widthOfTextAtSize(number, 8);
      page.drawText(truncate(`LectrFlo · ${title}`, regular, 8, CONTENT_WIDTH - numberWidth - 24), {
        x: MARGIN_X,
        y: 36,
        size: 8,
        font: regular,
        color: MUTED,
      });
      page.drawText(number, { x: MARGIN_X + CONTENT_WIDTH - numberWidth, y: 36, size: 8, font: regular, color: MUTED });
    });
  }
}

/** Renders a student's lecture notes as an A4 PDF. */
export async function renderNotesPdf(notes: NotesExport): Promise<Uint8Array> {
  const [regular, bold, display] = await loadFontFiles();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts: Fonts = {
    regular: await doc.embedFont(regular, { subset: true }),
    bold: await doc.embedFont(bold, { subset: true }),
    display: await doc.embedFont(display, { subset: true }),
  };
  doc.setTitle(`${notes.title} — notes`);
  doc.setCreator("LectrFlo");
  doc.setProducer("LectrFlo");

  const writer = new PdfWriter(doc, fonts);
  writer.header(notes);
  for (const section of notes.sections) {
    writer.heading(section.heading);
    if (!section.items.length) writer.empty(section.empty);
    for (const item of section.items) writer.item(item);
  }
  writer.footers(notes.title);
  return doc.save();
}
