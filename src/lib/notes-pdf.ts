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
const USABLE_HEIGHT = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;
const ANSWER_INDENT = 14;
const MAX_MARKER_INDENT = 40;
const MAX_NOTE_INDENT = 120;
const BAR_WIDTH = 1.5;
const BODY = { size: 10.5, leading: 15.5 };
const LABEL = { size: 8, leading: 13 };
const QUESTION = { size: 11, leading: 16 };
const HEADING = { size: 15, leading: 20, before: 16, after: 12 };
const SUBHEADING = { size: 10, leading: 16, before: 6 };
// Words longer than this (in characters) are measured per character, so splitting them stays linear.
const LONG_WORD = 48;
// Caps the characters drawn in one call, so a run of zero-width characters can't make one huge text layout.
const MAX_CHUNK = 200;

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
const characterWidths = new WeakMap<PDFFont, Map<string, number>>();

/**
 * Makes text safe to measure and draw. Tabs and NEL become spaces (pdf-lib would draw them wider than
 * measured) and other control characters go. Stacks of combining marks are capped, because laying them out
 * gets slow. Emoji the font has no glyph for are dropped, since they would print as empty boxes; other
 * missing characters still print as a box, so they stay visible.
 */
function clean(text: string, font: PDFFont): string {
  let supported = characterSets.get(font);
  if (!supported) characterSets.set(font, (supported = new Set(font.getCharacterSet())));
  const known = supported;
  return text
    .replace(/[\t\u0085]/g, (c) => (c === "\t" ? "    " : " "))
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "")
    .replace(/(\p{M}{4})\p{M}+/gu, "$1")
    .replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}‍️]/gu, (c) => (known.has(c.codePointAt(0)!) ? c : ""));
}

function charWidth(font: PDFFont, char: string, size: number): number {
  let widths = characterWidths.get(font);
  if (!widths) characterWidths.set(font, (widths = new Map()));
  let width = widths.get(char);
  if (width === undefined) widths.set(char, (width = font.widthOfTextAtSize(char, 1000)));
  return (width * size) / 1000;
}

/** Word-wraps mixed-font text to `maxWidth`, splitting words that are wider than a whole line. */
export function wrap(pieces: Segment[], size: number, maxWidth: number): Line[] {
  const limit = Math.max(maxWidth, size * 2);
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
    for (const token of clean(piece.text, piece.font).split(/(\s+)/)) {
      if (!token) continue;
      if (/^\s+$/.test(token)) {
        if (line.segments.length) space = { ...piece, text: " " };
        continue;
      }
      const chars = Array.from(token);
      const widths = chars.length > LONG_WORD ? chars.map((c) => charWidth(piece.font, c, size)) : null;
      const wordWidth = widths ? widths.reduce((a, b) => a + b, 0) : piece.font.widthOfTextAtSize(token, size);
      const spaceWidth = space ? space.font.widthOfTextAtSize(" ", size) : 0;
      if (line.segments.length && line.width + spaceWidth + wordWidth > limit) breakLine();
      else if (space) append(space, spaceWidth);
      space = null;
      if (wordWidth <= limit - line.width && chars.length <= MAX_CHUNK) {
        append({ ...piece, text: token }, wordWidth);
        continue;
      }

      // Too wide for one line (a pasted link, say), or very long: split it between characters.
      const w = widths ?? chars.map((c) => charWidth(piece.font, c, size));
      let start = 0;
      let run = 0;
      for (let i = 0; i < chars.length; i++) {
        const full = run + w[i] > limit - line.width;
        if (full || i - start >= MAX_CHUNK) {
          if (i > start) append({ ...piece, text: chars.slice(start, i).join("") }, run);
          if (full && line.segments.length) breakLine();
          start = i;
          run = 0;
        }
        run += w[i];
      }
      append({ ...piece, text: chars.slice(start).join("") }, run);
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

  /** Moves to a new page unless `height` more points fit on this one (anything taller than a page just flows). */
  private ensure(height: number) {
    if (this.y - Math.min(height, USABLE_HEIGHT) < MARGIN_BOTTOM && !this.atTop) this.newPage();
  }

  /** Vertical space (never onto a new page), continuing an answer's bar through it. */
  private gap(points: number, bar?: RGB) {
    const next = Math.max(MARGIN_BOTTOM, this.y - points);
    if (bar && next < this.y && !this.atTop) {
      this.page.drawRectangle({ x: MARGIN_X, y: next, width: BAR_WIDTH, height: this.y - next, color: bar });
    }
    this.y = next;
  }

  private markerIndent(o: TextOptions) {
    if (!o.marker) return 0;
    return Math.min(MAX_MARKER_INDENT, Math.max(14, o.marker.font.widthOfTextAtSize(o.marker.text, o.size) + 6));
  }

  private lines(lines: Line[], o: TextOptions) {
    const x = o.x ?? MARGIN_X;
    const indent = this.markerIndent(o);
    lines.forEach((line, i) => {
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

  private text(pieces: Segment[], o: TextOptions) {
    this.lines(wrap(pieces, o.size, (o.width ?? CONTENT_WIDTH) - this.markerIndent(o)), o);
  }

  /** The student's own notes: every line kept, with its indentation, and no Markdown. */
  private plain(text: string) {
    const { regular } = this.fonts;
    const spaceWidth = regular.widthOfTextAtSize(" ", BODY.size);
    let started = false;
    let blank = false;
    for (const raw of text.split(/\r\n?|\n/)) {
      if (!raw.trim()) {
        blank = started;
        continue;
      }
      if (blank) this.gap(BODY.leading / 2);
      started = true;
      blank = false;
      const indent = Math.min(MAX_NOTE_INDENT, raw.match(/^\s*/)![0].replace(/\t/g, "    ").length * spaceWidth);
      this.text([{ text: raw, font: regular, color: INK }], { ...BODY, x: MARGIN_X + indent, width: CONTENT_WIDTH - indent });
    }
  }

  /** Lecture AI text: paragraphs, lists and **bold**, as in the chat. */
  private rich(text: string, o: { x?: number; width?: number; color: RGB; bar?: RGB }) {
    parseRichText(text).forEach((block, i) => {
      if (block.kind === "gap") return this.gap(6, o.bar);
      if (i > 0) this.gap(3, o.bar);
      const pieces = block.runs.map((r) => ({ text: r.text, font: r.bold ? this.fonts.bold : this.fonts.regular, color: o.color }));
      const marker = block.kind === "item" ? { text: block.marker, font: this.fonts.regular, color: o.color } : undefined;
      this.text(pieces, { ...BODY, x: o.x, width: o.width, bar: o.bar, marker });
    });
  }

  private wrapQuestion(item: Extract<ExportItem, { kind: "qa" }>) {
    return item.question
      ? wrap([{ text: item.question, font: this.fonts.bold, color: INK }], QUESTION.size, CONTENT_WIDTH)
      : [];
  }

  /** Height to keep together at the start of an item, so it doesn't begin on the last lines of a page. */
  private keepHeight(item: ExportItem | undefined, question?: Line[]): number {
    switch (item?.kind) {
      case "qa":
        return LABEL.leading + (question ?? this.wrapQuestion(item)).length * QUESTION.leading + 4 + 2 * BODY.leading;
      case "subheading":
        return SUBHEADING.before + SUBHEADING.leading + 2 * BODY.leading;
      default:
        return 2 * BODY.leading;
    }
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

  /** A section heading, kept on the same page as the start of the section's first item. */
  heading(text: string, first: ExportItem | undefined) {
    this.ensure(HEADING.before + HEADING.leading + HEADING.after + this.keepHeight(first));
    if (!this.atTop) this.gap(HEADING.before);
    this.text([{ text, font: this.fonts.display, color: NAVY }], HEADING);
    this.page.drawLine({
      start: { x: MARGIN_X, y: this.y - 2 },
      end: { x: MARGIN_X + CONTENT_WIDTH, y: this.y - 2 },
      thickness: 0.75,
      color: RULE,
    });
    this.gap(HEADING.after);
  }

  empty(text: string) {
    this.text([{ text, font: this.fonts.regular, color: MUTED }], BODY);
  }

  item(item: ExportItem) {
    const { regular, bold } = this.fonts;
    switch (item.kind) {
      case "text":
        return this.plain(item.text);
      case "subheading":
        this.ensure(this.keepHeight(item));
        if (!this.atTop) this.gap(SUBHEADING.before);
        return this.text([{ text: item.text, font: bold, color: NAVY }], SUBHEADING);
      case "entry": {
        const pieces: Segment[] = [{ text: item.text, font: regular, color: INK }];
        if (item.meta) pieces.push({ text: ` — ${item.meta}`, font: regular, color: MUTED });
        this.text(pieces, { ...BODY, marker: { text: "•", font: regular, color: BRASS } });
        return this.gap(3);
      }
      case "qa": {
        // Keep the label, the whole question and the start of the answer together.
        const question = this.wrapQuestion(item);
        this.ensure(this.keepHeight(item, question));
        this.text([{ text: item.label.toUpperCase(), font: bold, color: BRASS }], LABEL);
        this.lines(question, QUESTION);
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
  }

  footers(title: string) {
    const { regular } = this.fonts;
    const pages = this.doc.getPages();
    const widest = regular.widthOfTextAtSize(`Page ${pages.length} of ${pages.length}`, 8);
    const label = truncate(`LectrFlo · ${title}`, regular, 8, CONTENT_WIDTH - widest - 24);
    pages.forEach((page, i) => {
      const number = `Page ${i + 1} of ${pages.length}`;
      const numberWidth = regular.widthOfTextAtSize(number, 8);
      page.drawText(label, { x: MARGIN_X, y: 36, size: 8, font: regular, color: MUTED });
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
    writer.heading(section.heading, section.items[0]);
    if (!section.items.length) writer.empty(section.empty);
    for (const item of section.items) writer.item(item);
  }
  writer.footers(notes.title);
  return doc.save();
}
