"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConfusionMeter,
  JoinCodeCard,
  JoinPresentation,
  LectureControls,
  LiveSignals,
  QuestionFeed,
  StudentsCard,
} from "@/components/lecturer/panels";
import { ReportView } from "@/components/lecturer/report-view";
import { SlideViewer } from "@/components/slide-viewer";
import { AppHeader, Button, ConnectionDot, ErrorNotice, LoadingScreen, StatusBadge, splitTitle } from "@/components/ui";
import { useCoalescedRefresh, useInterval, useRealtimeChannel } from "@/lib/client/hooks";
import { ClientApiError, errorMessage } from "@/lib/client/http";
import { lecturerApi } from "@/lib/client/lecturer-api";
import { createSlideUrlCache } from "@/lib/client/slide-url-cache";
import { lectureChannel, type HostChannelEvents, type LectureChannelEvents } from "@/lib/realtime";
import type { ConfusionSummary, LecturerLecture, LecturerLectureDetail, LecturerQuestion } from "@/lib/types";

function mergeQuestions(current: LecturerQuestion[], incoming: LecturerQuestion[]): LecturerQuestion[] {
  const byId = new Map(current.map((q) => [q.id, q]));
  for (const q of incoming) byId.set(q.id, q);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export default function LecturerConsole() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const [detail, setDetail] = useState<LecturerLectureDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confusion, setConfusion] = useState<ConfusionSummary | null>(null);
  const [questions, setQuestions] = useState<LecturerQuestion[]>([]);
  const [signalsError, setSignalsError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [urlCache] = useState(createSlideUrlCache);
  const [presenting, setPresenting] = useState(false);
  // Bumped by every fetch and local change; a response is applied only if nothing newer happened meanwhile.
  const detailVersion = useRef(0);
  const confusionVersion = useRef(0);

  const loadDetail = useCallback(async () => {
    const version = ++detailVersion.current;
    try {
      const { lecture } = await lecturerApi.getLecture(lectureId);
      if (version !== detailVersion.current) return;
      setDetail({ ...lecture, slides: urlCache.stabilize(lecture.slides) });
      setLoadError(null);
    } catch (err) {
      if (version !== detailVersion.current) return;
      setLoadError(
        err instanceof ClientApiError && err.status === 404
          ? "Lecture not found. Lectures belong to the browser that created them."
          : errorMessage(err),
      );
    }
  }, [lectureId, urlCache]);

  const refreshConfusion = useCallback(async () => {
    const version = ++confusionVersion.current;
    try {
      const summary = await lecturerApi.confusion(lectureId);
      if (version !== confusionVersion.current) return;
      setConfusion(summary);
      setSignalsError(null);
    } catch (err) {
      if (version === confusionVersion.current) setSignalsError(`Couldn't refresh live signals: ${errorMessage(err)}`);
    }
  }, [lectureId]);

  const refreshQuestions = useCallback(async () => {
    try {
      const { questions: fetched } = await lecturerApi.questions(lectureId);
      // Questions are never deleted, so merging can't resurrect anything and keeps realtime arrivals.
      setQuestions((qs) => mergeQuestions(qs, fetched));
      setSignalsError(null);
    } catch (err) {
      setSignalsError(`Couldn't refresh questions: ${errorMessage(err)}`);
    }
  }, [lectureId]);

  const requestDetail = useCoalescedRefresh(loadDetail);
  const requestConfusion = useCoalescedRefresh(refreshConfusion);

  const refreshAll = useCallback(() => {
    void loadDetail();
    void refreshConfusion();
    void refreshQuestions();
  }, [loadDetail, refreshConfusion, refreshQuestions]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshAll();
  }, [refreshAll]);

  const active = detail?.status === "lobby" || detail?.status === "live";
  // Realtime pushes changes instantly; polling keeps the confusion window fresh and covers dropped events.
  useInterval(() => void refreshConfusion(), 10_000, active);
  useInterval(() => void refreshQuestions(), 20_000, active);
  useInterval(() => void loadDetail(), 30_000, active);

  // The host channel name is a secret only this lecturer receives, so its payloads are trusted.
  const hostStatus = useRealtimeChannel<HostChannelEvents>(
    detail?.hostChannel ?? null,
    {
      participant_joined: (p) =>
        setDetail((d) =>
          d
            ? {
                ...d,
                participantCount: p.participantCount,
                participants: [...d.participants, { displayName: p.displayName, joinedAt: p.joinedAt }],
              }
            : d,
        ),
      confusion: () => requestConfusion(),
      question_created: (p) => setQuestions((qs) => mergeQuestions(qs, [p.question])),
    },
    refreshAll,
  );

  // The lecture channel is public (anyone can broadcast on it): treat events as a hint to refetch, never as data.
  useRealtimeChannel<LectureChannelEvents>(detail ? lectureChannel(detail.id) : null, {
    lecture_state: () => requestDetail(),
  });

  const applyLecture = useCallback((lecture: LecturerLecture) => {
    detailVersion.current++;
    setDetail((d) => (d ? { ...d, ...lecture } : d));
  }, []);

  async function runAction(action: "open" | "start" | "end") {
    if (action === "end" && !window.confirm("End the lecture for everyone? This generates the AI insight report.")) return;
    setBusy(action);
    setActionError(null);
    try {
      applyLecture((await lecturerApi.lifecycle(lectureId, action)).lecture);
      requestConfusion();
    } catch (err) {
      setActionError(errorMessage(err));
      void loadDetail();
    } finally {
      setBusy(null);
    }
  }

  const goToSlide = useCallback(
    async (slideNumber: number) => {
      if (!detail || slideNumber < 1 || slideNumber > detail.slideCount || busy) return;
      setBusy("slide");
      setActionError(null);
      detailVersion.current++;
      setDetail((d) => (d ? { ...d, currentSlide: slideNumber } : d));
      try {
        applyLecture((await lecturerApi.setSlide(lectureId, slideNumber)).lecture);
        requestConfusion();
      } catch (err) {
        setActionError(errorMessage(err));
        void loadDetail();
      } finally {
        setBusy(null);
      }
    },
    [detail, busy, lectureId, applyLecture, requestConfusion, loadDetail],
  );

  const onImageError = useCallback(
    (url: string) => {
      if (urlCache.invalidate(url)) requestDetail();
    },
    [urlCache, requestDetail],
  );

  useEffect(() => {
    if (!detail || detail.status === "ended") return;
    const current = detail.currentSlide;
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      const step = e.key === "ArrowRight" || e.key === "PageDown" ? 1 : e.key === "ArrowLeft" || e.key === "PageUp" ? -1 : 0;
      if (!step) return;
      // Clickers send PageUp/PageDown; don't also scroll the page.
      e.preventDefault();
      void goToSlide(current + step);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail, goToSlide]);

  useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPresenting(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presenting]);

  if (!detail) {
    return (
      <>
        <AppHeader role="Lecturer" />
        {loadError ? (
          <main className="mx-auto max-w-xl space-y-4 px-4 py-16">
            <ErrorNotice message={loadError} onRetry={refreshAll} />
            <Link href="/lecturer" className="text-sm font-medium text-ai-bright hover:text-fg">
              ← Back to lectures
            </Link>
          </main>
        ) : (
          <LoadingScreen label="Loading lecture…" />
        )}
      </>
    );
  }

  const slide = detail.slides.find((s) => s.slideNumber === detail.currentSlide);
  const { course, topic } = splitTitle(detail.title);
  const ended = detail.status === "ended";

  return (
    <>
      <AppHeader
        role="Lecturer"
        title={
          <>
            <p className="min-w-0 truncate text-sm">
              <span className="font-medium text-fg">{course}</span>
              {topic && <span className="text-muted"> · {topic}</span>}
            </p>
            <StatusBadge status={detail.status} />
          </>
        }
      >
        {!ended && <ConnectionDot status={hostStatus} />}
        <Link href="/lecturer" className="text-sm text-muted transition hover:text-fg">
          All lectures
        </Link>
      </AppHeader>

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:py-8">
        {/* Title on small screens (the header shows it from md up). */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 md:hidden">
          <div className="min-w-0">
            {detail.module && <p className="text-xs text-muted">{detail.module}</p>}
            <h1 className="text-xl font-semibold tracking-tight">{detail.title}</h1>
          </div>
          <StatusBadge status={detail.status} />
        </div>

        {actionError && (
          <div className="mb-4">
            <ErrorNotice message={actionError} />
          </div>
        )}

        {ended ? (
          <ReportView lectureId={detail.id} title={detail.title} module={detail.module} slideCount={detail.slideCount} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="min-w-0 space-y-4">
              {detail.status === "lobby" ? (
                <div className="relative overflow-hidden rounded-2xl border border-line bg-surface">
                  <div className="pointer-events-none absolute inset-0" aria-hidden>
                    <div className="ambient-glow opacity-70" />
                  </div>
                  <div className="relative flex aspect-video items-center justify-center">
                    <JoinPresentation joinCode={detail.joinCode} studentCount={detail.participantCount} compact />
                  </div>
                  <p className="relative border-t border-line bg-surface px-4 py-2.5 text-xs text-muted">
                    Lobby is open — students join with this code. Start the lecture to show slide {detail.currentSlide}.
                  </p>
                </div>
              ) : (
                <SlideViewer
                  slide={slide}
                  slideNumber={detail.currentSlide}
                  slideCount={detail.slideCount}
                  onImageError={onImageError}
                />
              )}
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="secondary"
                  onClick={() => goToSlide(detail.currentSlide - 1)}
                  disabled={detail.currentSlide <= 1 || busy !== null}
                  aria-label="Previous slide"
                >
                  ← Previous
                </Button>
                <span className="hidden text-xs text-faint sm:inline">
                  Use <kbd className="rounded border border-line-strong px-1.5 py-0.5 font-sans text-muted">←</kbd>{" "}
                  <kbd className="rounded border border-line-strong px-1.5 py-0.5 font-sans text-muted">→</kbd> or a clicker
                </span>
                <span className="text-sm tabular-nums text-muted sm:hidden">
                  {detail.slideCount > 0 ? `${detail.currentSlide} / ${detail.slideCount}` : "No slides"}
                </span>
                <Button
                  variant="secondary"
                  onClick={() => goToSlide(detail.currentSlide + 1)}
                  disabled={detail.currentSlide >= detail.slideCount || busy !== null}
                  aria-label="Next slide"
                >
                  Next →
                </Button>
              </div>
              <QuestionFeed questions={questions} error={signalsError} />
            </div>

            <aside className="space-y-4" aria-label="Classroom">
              <LectureControls status={detail.status} busy={busy} onAction={runAction} />
              <LiveSignals studentCount={detail.participantCount} summary={confusion} questionCount={questions.length} />
              <JoinCodeCard joinCode={detail.joinCode} status={detail.status} onPresent={() => setPresenting(true)} />
              <ConfusionMeter summary={confusion} participantCount={detail.participantCount} slideCount={detail.slideCount} />
              <StudentsCard count={detail.participantCount} participants={detail.participants} />
            </aside>
          </div>
        )}
      </main>

      {presenting && !ended && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Join this lecture"
          className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-canvas/95 backdrop-blur-sm"
          onClick={() => setPresenting(false)}
        >
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="ambient-glow" />
          </div>
          <div className="relative animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <JoinPresentation joinCode={detail.joinCode} studentCount={detail.participantCount} />
          </div>
          <button
            type="button"
            onClick={() => setPresenting(false)}
            className="absolute top-5 right-5 rounded-lg px-3 py-1.5 text-sm text-muted ring-1 ring-line-strong transition hover:text-fg"
            autoFocus
          >
            Close <span className="text-faint">Esc</span>
          </button>
        </div>
      )}
    </>
  );
}
