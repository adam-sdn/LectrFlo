"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button, Card, Spinner } from "@/components/ui";
import type { ConfusionSummary, LectureStatus, LecturerQuestion } from "@/lib/types";

const noopSubscribe = () => () => {};

function useOrigin(): string {
  return useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
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
    <Card title="Lecture controls">
      {status === "draft" && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">Open the lobby so students can join with the code, then start when ready.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onAction("open")} disabled={busy !== null}>
              {label("open", "Open lobby")}
            </Button>
            <Button variant="secondary" onClick={() => onAction("start")} disabled={busy !== null}>
              {label("start", "Start now")}
            </Button>
          </div>
        </div>
      )}
      {status === "lobby" && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">Students can join now. They see a waiting screen until you start.</p>
          <Button onClick={() => onAction("start")} disabled={busy !== null} className="w-full">
            {label("start", "Start lecture")}
          </Button>
        </div>
      )}
      {status === "live" && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">Students follow your current slide. Use ← → to change slides.</p>
          <Button variant="danger" onClick={() => onAction("end")} disabled={busy !== null} className="w-full">
            {label("end", "End lecture")}
          </Button>
        </div>
      )}
      {status === "ended" && <p className="text-sm text-slate-600">This lecture has ended.</p>}
    </Card>
  );
}

export function JoinCodeCard({ joinCode, status }: { joinCode: string; status: LectureStatus }) {
  const origin = useOrigin();
  const [enlarged, setEnlarged] = useState(false);
  const joinable = status === "lobby" || status === "live";
  const joinPage = origin ? `${origin.replace(/^https?:\/\//, "")}/join` : "/join";
  // Scanning opens the join page with the code already filled in.
  const joinUrl = origin ? `${origin}/join?code=${joinCode}` : null;

  return (
    <Card title="Join code">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-4xl font-bold tracking-[0.2em] text-slate-900" aria-label={`Join code ${joinCode.split("").join(" ")}`}>
            {joinCode}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Students go to
            <span className="block font-semibold break-all text-slate-900">{joinPage}</span>
          </p>
          <p className="mt-1 text-sm text-slate-600">or scan the QR code with their phone.</p>
        </div>
        {joinUrl && (
          <button
            type="button"
            onClick={() => setEnlarged(true)}
            className="shrink-0 rounded-lg bg-white p-1.5 ring-1 ring-slate-200 transition hover:ring-indigo-400 focus-visible:outline-2 focus-visible:outline-indigo-600"
            aria-label="Enlarge QR code for projecting"
            title="Enlarge for projecting"
          >
            <QRCodeSVG value={joinUrl} size={104} level="M" marginSize={1} title={`Join ${joinCode}`} />
          </button>
        )}
      </div>
      {joinUrl && (
        <button
          type="button"
          onClick={() => setEnlarged(true)}
          className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-500"
        >
          Show large QR code for the room →
        </button>
      )}
      {!joinable && <p className="mt-2 text-xs font-medium text-amber-700">Open the lobby to let students join.</p>}
      {enlarged && joinUrl && (
        <QrOverlay joinUrl={joinUrl} joinCode={joinCode} joinPage={joinPage} onClose={() => setEnlarged(false)} />
      )}
    </Card>
  );
}

function QrOverlay({
  joinUrl,
  joinCode,
  joinPage,
  onClose,
}: {
  joinUrl: string;
  joinCode: string;
  joinPage: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Join this lecture"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white p-6 text-center"
    >
      <p className="text-2xl font-bold text-slate-900 sm:text-3xl">Scan to join the lecture</p>
      <QRCodeSVG
        value={joinUrl}
        size={480}
        level="M"
        marginSize={2}
        title={`Join ${joinCode}`}
        className="h-auto w-[min(70vh,80vw)] max-w-full"
      />
      <div>
        <p className="font-mono text-5xl font-bold tracking-[0.25em] text-slate-900">{joinCode}</p>
        <p className="mt-2 text-lg text-slate-600">
          or go to <span className="font-semibold text-slate-900">{joinPage}</span>
        </p>
      </div>
      <Button ref={closeRef} variant="secondary" onClick={onClose}>
        Close (Esc)
      </Button>
    </div>
  );
}

export function StudentsCard({
  count,
  participants,
}: {
  count: number;
  participants: { displayName: string; joinedAt: string }[];
}) {
  const recent = [...participants].reverse().slice(0, 8);
  return (
    <Card title="Students connected" action={<span className="text-2xl font-bold tabular-nums">{count}</span>}>
      {count === 0 ? (
        <p className="text-sm text-slate-500">Waiting for students to join…</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5" aria-label="Recently joined students">
          {recent.map((p, i) => (
            <li key={`${p.joinedAt}-${i}`} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
              {p.displayName}
            </li>
          ))}
          {count > recent.length && <li className="px-1 text-xs text-slate-500">+{count - recent.length} more</li>}
        </ul>
      )}
    </Card>
  );
}

export function ConfusionMeter({ summary, participantCount }: { summary: ConfusionSummary | null; participantCount: number }) {
  if (!summary) {
    return (
      <Card title="Confusion">
        <div className="flex items-center gap-2 text-sm text-slate-500">
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
    clear: { ring: "ring-emerald-200 bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-500", label: "No confusion on this slide" },
    some: { ring: "ring-amber-200 bg-amber-50", text: "text-amber-700", bar: "bg-amber-500", label: "Some students are confused" },
    high: { ring: "ring-rose-300 bg-rose-50", text: "text-rose-700", bar: "bg-rose-500", label: "Many students are confused — consider re-explaining" },
  }[level];
  const totals = summary.bySlide.filter((s) => s.uniqueStudents > 0);

  return (
    <section className={`rounded-2xl p-5 shadow-sm ring-1 ${styles.ring}`} aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">🤔 I&apos;m confused</h2>
        <span className="text-xs text-slate-500">Slide {summary.currentSlide} · last {Math.round(summary.windowSeconds / 60)} min</span>
      </div>
      <p className={`mt-2 text-5xl font-bold tabular-nums ${styles.text}`}>
        {confused}
        <span className="ml-2 text-base font-medium text-slate-500">
          of {total} student{total === 1 ? "" : "s"}
        </span>
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80" aria-hidden>
        <div className={`h-full rounded-full transition-all ${styles.bar}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
      <p className={`mt-2 text-sm font-medium ${styles.text}`}>{styles.label}</p>
      {totals.length > 0 && (
        <p className="mt-3 text-xs text-slate-600">
          Whole lecture: {totals.map((s) => `slide ${s.slideNumber} (${s.uniqueStudents})`).join(" · ")}
        </p>
      )}
    </section>
  );
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

export function QuestionFeed({ questions, error }: { questions: LecturerQuestion[]; error: string | null }) {
  const sorted = [...questions].reverse();
  return (
    <Card
      title="Student questions"
      action={<span className="text-xs text-slate-500">Anonymous · {questions.length} total</span>}
    >
      {error && <p className="mb-2 text-xs text-rose-700">{error}</p>}
      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500">No questions yet. Students can send questions from their screen.</p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto pr-1" aria-live="polite">
          {sorted.map((q) => (
            <li key={q.id} className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
              <p className="text-sm text-slate-900">{q.body}</p>
              <p className="mt-1 text-xs text-slate-500">
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
