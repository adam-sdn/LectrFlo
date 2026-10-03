"use client";

import { lecturerApi } from "./lecturer-api";

interface DemoSlide {
  title: string;
  bullets: string[];
  formulas?: string[];
  /** Plain-text version sent to the API as slide text, used as Lecture AI context. */
  text: string;
}

export const DEMO_LECTURE = {
  title: "Calculus 101 — Differentiation",
  module: "MATH 101 · Week 4",
  description: "Rates of change, the limit definition of the derivative, and the core differentiation rules.",
  objectives: [
    "Explain the derivative as an instantaneous rate of change",
    "Use the limit definition to differentiate simple functions",
    "Apply the power, product and chain rules",
  ],
};

const SLIDES: DemoSlide[] = [
  {
    title: "Calculus 101",
    bullets: ["Differentiation", "Lecture 4 · Rates of change and the derivative"],
    text: "Calculus 101: Differentiation. Lecture 4 covers rates of change and the derivative.",
  },
  {
    title: "What is a derivative?",
    bullets: [
      "The instantaneous rate of change of a function",
      "The slope of the tangent line at a point",
      "Notation: f′(x),  dy/dx,  d/dx [ f(x) ]",
    ],
    formulas: ["slope = Δy / Δx   →   dy/dx  as  Δx → 0"],
    text:
      "What is a derivative? The derivative is the instantaneous rate of change of a function, " +
      "equivalently the slope of the tangent line at a point. Notation: f'(x), dy/dx, d/dx[f(x)]. " +
      "The average slope Δy/Δx becomes dy/dx as Δx approaches 0.",
  },
  {
    title: "The limit definition",
    formulas: ["f′(x) = lim (h → 0)  [ f(x + h) − f(x) ] / h"],
    bullets: [
      "Take the slope of the secant line between x and x + h",
      "Let h shrink towards 0",
      "Example: f(x) = x²  ⇒  [ (x + h)² − x² ] / h = 2x + h  →  2x",
    ],
    text:
      "The limit definition of the derivative: f'(x) = limit as h approaches 0 of [f(x+h) - f(x)] / h. " +
      "Take the slope of the secant line between x and x+h, then let h shrink to 0. " +
      "Example: for f(x) = x^2, [(x+h)^2 - x^2]/h = 2x + h, which tends to 2x, so f'(x) = 2x.",
  },
  {
    title: "The power rule",
    formulas: ["d/dx [ xⁿ ] = n · xⁿ⁻¹"],
    bullets: [
      "d/dx [ x³ ] = 3x²",
      "d/dx [ 5x² ] = 10x",
      "d/dx [ √x ] = d/dx [ x^½ ] = ½ · x^(−½)",
      "The derivative of a constant is 0",
    ],
    text:
      "The power rule: d/dx[x^n] = n x^(n-1). Examples: d/dx[x^3] = 3x^2; d/dx[5x^2] = 10x; " +
      "d/dx[sqrt(x)] = d/dx[x^(1/2)] = (1/2) x^(-1/2). The derivative of a constant is 0.",
  },
  {
    title: "Product and chain rules",
    formulas: ["( f · g )′ = f′ · g + f · g′", "( f ∘ g )′(x) = f′( g(x) ) · g′(x)"],
    bullets: [
      "Product: d/dx [ x² · sin x ] = 2x · sin x + x² · cos x",
      "Chain: d/dx [ (3x + 1)⁵ ] = 5(3x + 1)⁴ · 3 = 15(3x + 1)⁴",
    ],
    text:
      "Product rule: (f g)' = f' g + f g'. Example: d/dx[x^2 sin x] = 2x sin x + x^2 cos x. " +
      "Chain rule: (f o g)'(x) = f'(g(x)) g'(x). Example: d/dx[(3x+1)^5] = 5(3x+1)^4 * 3 = 15(3x+1)^4.",
  },
  {
    title: "Practice and summary",
    bullets: [
      "1.  Differentiate f(x) = 4x³ − 2x + 7",
      "2.  Differentiate g(x) = (2x − 1)⁴",
      "3.  Find the slope of y = x² at x = 3",
      "The derivative measures instantaneous change: use the rules, check with the limit.",
    ],
    text:
      "Practice: 1. Differentiate f(x) = 4x^3 - 2x + 7. 2. Differentiate g(x) = (2x - 1)^4. " +
      "3. Find the slope of y = x^2 at x = 3. Summary: the derivative measures instantaneous change; " +
      "use the differentiation rules and check with the limit definition.",
  },
];

const W = 1600;
const H = 900;
const SANS = "Inter, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const SERIF = "'Cambria Math', Cambria, Georgia, 'Times New Roman', serif";

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawTitleSlide(ctx: CanvasRenderingContext2D, slide: DemoSlide) {
  ctx.fillStyle = "#1f2d52";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#a8803a";
  ctx.fillRect(0, H - 24, W, 24);
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 120px ${SERIF}`;
  ctx.fillText(slide.title, 120, 400);
  ctx.fillStyle = "#e6d2a6";
  ctx.font = `600 72px ${SANS}`;
  ctx.fillText(slide.bullets[0], 120, 510);
  ctx.fillStyle = "#f1f3f8";
  ctx.font = `400 40px ${SANS}`;
  ctx.fillText(slide.bullets[1], 120, 600);
}

function drawContentSlide(ctx: CanvasRenderingContext2D, slide: DemoSlide, index: number, total: number) {
  ctx.fillStyle = "#fbfaf6";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#1f2d52";
  ctx.fillRect(0, 0, 16, H);

  ctx.fillStyle = "#8a682e";
  ctx.font = `600 28px ${SANS}`;
  ctx.fillText("MATH 101 · DIFFERENTIATION", 100, 100);
  ctx.fillStyle = "#1b1814";
  ctx.font = `700 72px ${SERIF}`;
  ctx.fillText(slide.title, 100, 190);

  let y = 260;
  if (slide.formulas?.length) {
    const boxHeight = 60 + slide.formulas.length * 64;
    ctx.fillStyle = "#f1f3f8";
    ctx.fillRect(100, y, W - 200, boxHeight);
    ctx.fillStyle = "#1f2d52";
    ctx.fillRect(100, y, 6, boxHeight);
    ctx.fillStyle = "#1f2d52";
    ctx.font = `500 52px ${SERIF}`;
    slide.formulas.forEach((formula, i) => ctx.fillText(formula, 150, y + 82 + i * 64));
    y += boxHeight + 70;
  } else {
    y += 30;
  }

  ctx.font = `400 40px ${SANS}`;
  for (const bullet of slide.bullets) {
    ctx.fillStyle = "#a8803a";
    ctx.fillRect(110, y - 21, 14, 14);
    ctx.fillStyle = "#2c2823";
    for (const line of wrap(ctx, bullet, W - 300)) {
      ctx.fillText(line, 150, y);
      y += 54;
    }
    y += 22;
  }

  ctx.fillStyle = "#a39b8c";
  ctx.font = `400 24px ${SANS}`;
  ctx.fillText(`${index + 1} / ${total}`, W - 160, H - 50);
}

/** Renders the demo deck to PNG blobs in the browser. */
export async function renderDemoSlides(): Promise<Blob[]> {
  const blobs: Blob[] = [];
  for (const [i, slide] of SLIDES.entries()) {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available in this browser");
    ctx.textBaseline = "alphabetic";
    if (i === 0) drawTitleSlide(ctx, slide);
    else drawContentSlide(ctx, slide, i, SLIDES.length);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Couldn't render demo slides");
    blobs.push(blob);
  }
  return blobs;
}

async function step<T>(name: string, onStep: (step: string) => void, fn: () => Promise<T>): Promise<T> {
  onStep(`${name}…`);
  try {
    return await fn();
  } catch (err) {
    throw new Error(`${name} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Creates the demo lecture through the regular lecturer API and returns its id. */
export async function createDemoLecture(onStep: (step: string) => void): Promise<string> {
  const blobs = await step("Rendering slides", onStep, renderDemoSlides);
  const { lecture } = await step("Creating lecture", onStep, () =>
    lecturerApi.createLecture({
      title: DEMO_LECTURE.title,
      module: DEMO_LECTURE.module,
      description: DEMO_LECTURE.description,
    }),
  );
  try {
    await step("Uploading slides", onStep, () => lecturerApi.uploadSlides(lecture.id, blobs));
    await step("Adding slide text and objectives", onStep, () =>
      Promise.all([
        ...SLIDES.map((slide, i) => lecturerApi.setSlideText(lecture.id, i + 1, slide.text)),
        lecturerApi.setObjectives(lecture.id, DEMO_LECTURE.objectives),
      ]),
    );
  } catch (err) {
    // Don't leave a half-built demo lecture in the list.
    await lecturerApi.deleteLecture(lecture.id).catch(() => undefined);
    throw err;
  }
  return lecture.id;
}
