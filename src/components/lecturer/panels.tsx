"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AnimatedNumber, useCountUp, useIncreasePulse } from "@/components/motion";
import { Button, Card, Eyebrow, LiveDot, Spinner } from "@/components/ui";
import { encodeQr } from "@/lib/client/qr";
import type { ConfusionSummary, LectureStatus, LecturerQuestion } from "@/lib/types";

const noopSubscribe = () => () => {};

function useOrigin(): string {
  return useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
}

/** Full join URL for a code; the join page pre-fills `?code=`. */
function useJoinLink(joinCode: string) {
  const origin = useOrigin();
  return {
    url: origin ? `${origin}/join?code=${joinCode}` : "",
    display: origin ? `${origin.replace(/^https?:\/\//, "")}/join` : "/join",
  };
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Crisp SVG QR code. Dark modules on white for reliable scanning from a projector. */
export function QrCode({ value, className = "" }: { value: string; className?: string }) {
  const path = useMemo(() => {
    if (!value) return null;
    try {
      const { size, modules } = encodeQr(value);
      let d = "";
      modules.forEach((row, y) =>
        row.forEach((dark, x) => {
          if (dark) d += `M${x + 2} ${y + 2}h1v1h-1z`;
        }),
      );
      return { d, size: size + 4 };
    } catch {
      return null;
    }
  }, [value]);

  return (
    <div className={`overflow-hidden rounded-xl bg-white p-1.5 ${className}`}>
      {path ? (
        <svg viewBox={`0 0 ${path.size} ${path.size}`} className="block size-full" shapeRendering="crispEdges" role="img" aria-label="QR code for the join link">
          <path d={path.d} fill="#070A12" />
        </svg>
      ) : (
        <div className="aspect-square size-full animate-pulse rounded-lg bg-slate-200" />
      )}
    </div>
  );
}

function CopyButton({ text, label, copiedLabel = "Copied" }: { text: string; label: string; copiedLabel?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const id = setTimeout(() => setState("idle"), 1600);
    return () => clearTimeout(id);
  }, [state]);
  return (
    <Button
      variant="secondary"
      className="flex-1 px-3 text-xs"
      disabled={!text}
      onClick={async () => setState((await copyText(text)) ? "copied" : "failed")}
    >
      <span aria-live="polite" className={state === "copied" ? "text-success" : state === "failed" ? "text-confused" : ""}>
        {state === "copied" ? `✓ ${copiedLabel}` : state === "failed" ? "Copy failed" : label}
      </span>
    </Button>
  );
}

export function LectureControls({
  status,
  busy,
  onAction,
}: {
  status: LectureStatus;
  busy: string | null;
  onAction: (action: "open" | "start" | "end") => void;
}) {
  const label = (action: string, text: string) =>
    busy === action ? (
      <>
        <Spinner /> {text}
      </>
    ) : (
      text
    );
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      {status === "draft" && (
        <div className="space-y-3">
          <p className="text-sm text-muted">Open the lobby so students can join with the code, then start when you&apos;re ready.</p>
          <div className="flex gap-2">
            <Button onClick={() => onAction("open")} disabled={busy !== null} className="flex-1">
              {label("open", "Open lobby")}
            </Button>
            <Button variant="secondary" onClick={() => onAction("start")} disabled={busy !== null} className="flex-1">
              {label("start", "Start now")}
            </Button>
          </div>
        </div>
      )}
      {status === "lobby" && (
        <div className="space-y-3">
          <p className="text-sm text-muted">Students can join now. They see a waiting screen until you start.</p>
          <Button onClick={() => onAction("start")} disabled={busy !== null} className="w-full py-2.5">
            {label("start", "Start lecture")}
          </Button>
        </div>
      )}
      {status === "live" && (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium text-fg">
              <LiveDot /> Lecture is live
            </p>
            <p className="mt-0.5 text-xs text-muted">Students follow your slide. Use ← → to move.</p>
          </div>
          <Button variant="danger" onClick={() => onAction("end")} disabled={busy !== null} className="shrink-0">
            {label("end", "End lecture")}
          </Button>
        </div>
      )}
      {status === "ended" && <p className="text-sm text-muted">This lecture has ended.</p>}
    </section>
  );
}

export function JoinCodeCard({
  joinCode,
  status,
  onPresent,
}: {
  joinCode: string;
  status: LectureStatus;
  /** Opens the full-screen join view (big code + QR) for the projector. */
  onPresent?: () => void;
}) {
  const link = useJoinLink(joinCode);
  const joinable = status === "lobby" || status === "live";
  return (
    <Card title="Join this lecture" action={!joinable && <span className="text-xs text-ai-bright">Lobby closed</span>}>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onPresent}
          disabled={!onPresent}
          className="group relative shrink-0 rounded-xl transition hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ai-bright"
          aria-label="Show the QR code full screen"
        >
          <QrCode value={link.url} className="size-24" />
        </button>
        <div className="min-w-0">
          <p className="font-mono text-[1.7rem] leading-none font-medium tracking-[0.18em] text-fg" aria-label={`Join code ${joinCode.split("").join(" ")}`}>
            {joinCode}
          </p>
          <p className="mt-2 truncate text-xs text-muted">
            or visit <span className="text-fg-2">{link.display}</span>
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <CopyButton text={joinCode} label="Copy code" />
        <CopyButton text={link.url} label="Copy join link" />
      </div>
      {onPresent && (
        <button type="button" onClick={onPresent} className="mt-3 w-full text-center text-xs text-muted transition hover:text-fg">
          Show full screen for the room ↗
        </button>
      )}
      {!joinable && <p className="mt-3 text-xs text-muted">Open the lobby to let students join.</p>}
    </Card>
  );
}

/** Large join view for the projector: shown in the slide area while the lobby is open, and full screen on demand. */
export function JoinPresentation({ joinCode, studentCount, compact = false }: { joinCode: string; studentCount: number; compact?: boolean }) {
  const link = useJoinLink(joinCode);
  return (
    <div className={`flex flex-col items-center justify-center gap-6 text-center sm:flex-row sm:gap-12 sm:text-left ${compact ? "p-6" : "p-10"}`}>
      <QrCode value={link.url} className={compact ? "size-36 shrink-0 sm:size-44 lg:size-52" : "size-64 shrink-0 sm:size-80"} />
      <div className="min-w-0">
        <Eyebrow className="text-ai-bright">Join the lecture</Eyebrow>
        <p className={`mt-3 text-fg-2 ${compact ? "text-sm sm:text-base" : "text-xl"}`}>
          Scan the code, or go to <span className="font-medium text-fg">{link.display}</span>
        </p>
        <p
          className={`mt-3 font-mono font-medium tracking-[0.18em] text-fg ${compact ? "text-4xl sm:text-5xl lg:text-6xl" : "text-7xl sm:text-8xl"}`}
          aria-label={`Join code ${joinCode.split("").join(" ")}`}
        >
          {joinCode}
        </p>
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted" aria-live="polite">
          <LiveDot />
          <AnimatedNumber value={studentCount} className="font-medium text-fg" /> {studentCount === 1 ? "student has" : "students have"} joined
        </p>
      </div>
    </div>
  );
}

function SignalStat({
  label,
  hint,
  value,
  tone,
  pulseTone,
}: {
  label: string;
  hint: string;
  value: number | undefined;
  tone: string;
  pulseTone: string;
}) {
  const pulse = useIncreasePulse(value);
  const shown = useCountUp(value ?? 0, 500);
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-surface-2 px-3 py-3.5">
      {pulse > 0 && <span key={pulse} className={`pointer-events-none absolute inset-0 animate-ripple rounded-xl ${pulseTone}`} aria-hidden />}
      <p className={`relative text-3xl font-semibold tracking-tight tabular-nums transition-colors duration-300 ${tone}`}>
        {value === undefined ? (
          <span className="text-faint">–</span>
        ) : (
          // Re-keyed on each increase so the small lift replays; the count itself lives in this component.
          <span key={pulse} className={`inline-block ${pulse > 0 ? "animate-bump" : ""}`} aria-label={String(value)}>
            {Math.round(shown)}
          </span>
        )}
      </p>
      <p className="relative mt-1 text-xs font-medium text-fg-2">{label}</p>
      <p className="relative text-[11px] text-muted">{hint}</p>
    </div>
  );
}

/** Live classroom intelligence: the three numbers a lecturer glances at mid-sentence. */
export function LiveSignals({
  studentCount,
  summary,
  questionCount,
}: {
  studentCount: number;
  summary: ConfusionSummary | null;
  questionCount: number;
}) {
  const confused = summary?.recentUniqueStudents;
  return (
    <section aria-label="Live classroom signals" aria-live="polite">
      <div className="mb-3 flex items-center justify-between">
        <Eyebrow>Live classroom</Eyebrow>
        {summary && <span className="text-[11px] text-muted">Slide {summary.currentSlide}</span>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <SignalStat label="Students" hint="joined" value={studentCount} tone="text-fg" pulseTone="bg-live/15" />
        <SignalStat
          label="Confused"
          hint="this slide"
          value={confused}
          tone={confused ? "text-confused" : "text-fg"}
          pulseTone="bg-confused/20"
        />
        <SignalStat label="Questions" hint="anonymous" value={questionCount} tone="text-fg" pulseTone="bg-ai/20" />
      </div>
    </section>
  );
}

export function StudentsCard({
  count,
  participants,
}: {
  count: number;
  participants: { displayName: string; joinedAt: string }[];
}) {
  const recent = [...participants].reverse().slice(0, 10);
  return (
    <Card title="Students" action={<span className="text-sm tabular-nums text-muted">{count}</span>}>
      {count === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner className="size-3" /> Waiting for students to join…
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5" aria-label="Recently joined students">
          {recent.map((p, i) => (
            <li
              key={`${p.joinedAt}-${i}`}
              className="animate-fade-in rounded-lg border border-line bg-surface-2 px-2 py-0.5 text-xs text-fg-2"
            >
              {p.displayName}
            </li>
          ))}
          {count > recent.length && <li className="px-1 py-0.5 text-xs text-muted">+{count - recent.length} more</li>}
        </ul>
      )}
    </Card>
  );
}

export function ConfusionMeter({
  summary,
  participantCount,
  slideCount = 0,
}: {
  summary: ConfusionSummary | null;
  participantCount: number;
  slideCount?: number;
}) {
  if (!summary) {
    return (
      <Card title="Confusion">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Spinner /> Loading…
        </div>
      </Card>
    );
  }
  const confused = summary.recentUniqueStudents;
  const total = Math.max(participantCount, summary.participantCount);
  const ratio = total > 0 ? confused / total : 0;
  const level = confused === 0 ? "clear" : ratio >= 0.25 || confused >= 3 ? "high" : "some";
  const styles = {
    clear: { border: "border-line", text: "text-success", bar: "bg-success", label: "Class is following along" },
    some: { border: "border-confused/20", text: "text-confused", bar: "bg-confused/70", label: "A few students are confused" },
    high: {
      border: "border-confused/40 shadow-[0_0_40px_-16px_rgb(251_113_133/0.6)]",
      text: "text-confused",
      bar: "bg-confused",
      label: "Many students are confused — consider re-explaining",
    },
  }[level];
  const totals = summary.bySlide.filter((s) => s.uniqueStudents > 0);
  const peak = Math.max(1, ...totals.map((s) => s.uniqueStudents));
  // bySlide only lists slides with signals; show every slide so the shape of the lecture is visible.
  const barCount = Math.max(slideCount, summary.currentSlide, ...summary.bySlide.map((s) => s.slideNumber));
  const bars = Array.from({ length: barCount }, (_, i) => ({
    slideNumber: i + 1,
    uniqueStudents: summary.bySlide.find((s) => s.slideNumber === i + 1)?.uniqueStudents ?? 0,
  }));

  return (
    <section className={`rounded-2xl border bg-surface p-4 transition-[border-color,box-shadow] duration-500 ${styles.border}`} aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-fg">Confusion signals</h2>
        <span className="text-[11px] text-muted">last {Math.round(summary.windowSeconds / 60)} min</span>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <p className={`text-sm font-medium ${styles.text}`}>{styles.label}</p>
        <p className="shrink-0 text-xs tabular-nums text-muted">
          {confused} of {total}
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
        <div className={`h-full rounded-full transition-all duration-500 ${styles.bar}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
      {totals.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] text-muted">Whole lecture, by slide</p>
          <div className="mt-2 flex h-10 items-end gap-1" aria-label={totals.map((s) => `slide ${s.slideNumber}: ${s.uniqueStudents}`).join(", ")}>
            {bars.map((s) => (
              <span
                key={s.slideNumber}
                title={`Slide ${s.slideNumber}: ${s.uniqueStudents} student${s.uniqueStudents === 1 ? "" : "s"}`}
                className={`min-h-1 flex-1 rounded-sm transition-all duration-500 ${s.slideNumber === summary.currentSlide ? "bg-confused" : s.uniqueStudents ? "bg-confused/40" : "bg-white/[0.08]"}`}
                style={{ height: `${(s.uniqueStudents / peak) * 100}%` }}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

export function QuestionFeed({ questions, error }: { questions: LecturerQuestion[]; error: string | null }) {
  const sorted = [...questions].reverse();
  return (
    <Card title="Anonymous questions" action={<span className="text-xs tabular-nums text-muted">{questions.length} total</span>}>
      {error && <p className="mb-2 text-xs text-confused">{error}</p>}
      {sorted.length === 0 ? (
        <p className="text-sm text-muted">No questions yet. Students can send questions from their screen.</p>
      ) : (
        <ul className="scrollbar-thin -mr-2 max-h-80 space-y-2 overflow-y-auto pr-2" aria-live="polite">
          {sorted.map((q) => (
            <li key={q.id} className="animate-fade-up rounded-xl border border-line bg-surface-2 px-3.5 py-2.5">
              <p className="text-sm leading-snug text-fg">{q.body}</p>
              <p className="mt-1.5 text-[11px] text-muted">
                {q.slideNumber ? `Slide ${q.slideNumber} · ` : ""}
                {timeFormat.format(new Date(q.createdAt))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
