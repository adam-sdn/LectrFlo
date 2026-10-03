"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConfusionMeter, JoinCodeCard, LectureControls, QuestionFeed, StudentsCard } from "@/components/lecturer/panels";
import { ReportView } from "@/components/lecturer/report-view";
import { SlideViewer } from "@/components/slide-viewer";
import { AppHeader, Button, ConnectionDot, ErrorNotice, LoadingScreen, StatusBadge } from "@/components/ui";
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

  if (!detail) {
    return (
      <>
        <AppHeader role="Lecturer" />
        {loadError ? (
          <main className="mx-auto max-w-xl space-y-4 px-4 py-16">
            <ErrorNotice message={loadError} onRetry={refreshAll} />
            <Link href="/lecturer" className="text-sm font-semibold text-indigo-600">
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

  return (
    <>
      <AppHeader role="Lecturer">
        {detail.status !== "ended" && <ConnectionDot status={hostStatus} />}
        <Link href="/lecturer" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          All lectures
        </Link>
      </AppHeader>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {detail.module && <p className="text-sm font-medium text-indigo-600">{detail.module}</p>}
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{detail.title}</h1>
          </div>
          <StatusBadge status={detail.status} />
        </div>

        {actionError && (
          <div className="mb-4">
            <ErrorNotice message={actionError} />
          </div>
        )}

        {detail.status === "ended" ? (
          <ReportView lectureId={detail.id} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <SlideViewer
                slide={slide}
                slideNumber={detail.currentSlide}
                slideCount={detail.slideCount}
                onImageError={onImageError}
              />
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="secondary"
                  onClick={() => goToSlide(detail.currentSlide - 1)}
                  disabled={detail.currentSlide <= 1 || busy !== null}
                  aria-label="Previous slide"
                >
                  ← Previous
                </Button>
                <span className="text-sm font-medium tabular-nums text-slate-600">
                  {detail.slideCount > 0 ? `${detail.currentSlide} / ${detail.slideCount}` : "No slides"}
                </span>
                <Button
                  onClick={() => goToSlide(detail.currentSlide + 1)}
                  disabled={detail.currentSlide >= detail.slideCount || busy !== null}
                  aria-label="Next slide"
                >
                  Next →
                </Button>
              </div>
              <QuestionFeed questions={questions} error={signalsError} />
            </div>

            <div className="space-y-4">
              <LectureControls status={detail.status} busy={busy} onAction={runAction} />
              <ConfusionMeter summary={confusion} participantCount={detail.participantCount} />
              <JoinCodeCard joinCode={detail.joinCode} status={detail.status} />
              <StudentsCard count={detail.participantCount} participants={detail.participants} />
            </div>
          </div>
        )}
      </main>
    </>
  );
}
