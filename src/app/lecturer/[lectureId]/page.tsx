"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ConfusionMeter, JoinCodeCard, LectureControls, QuestionFeed, StudentsCard } from "@/components/lecturer/panels";
import { ReportView } from "@/components/lecturer/report-view";
import { SlideViewer } from "@/components/slide-viewer";
import { AppHeader, Button, ConnectionDot, ErrorNotice, LoadingScreen, StatusBadge } from "@/components/ui";
import { useInterval, useRealtimeChannel } from "@/lib/client/hooks";
import { ClientApiError, errorMessage } from "@/lib/client/http";
import { lecturerApi } from "@/lib/client/lecturer-api";
import { lectureChannel, type HostChannelEvents, type LectureChannelEvents } from "@/lib/realtime";
import type { ConfusionSummary, LecturerLecture, LecturerLectureDetail, LecturerQuestion } from "@/lib/types";

export default function LecturerConsole() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const [detail, setDetail] = useState<LecturerLectureDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confusion, setConfusion] = useState<ConfusionSummary | null>(null);
  const [questions, setQuestions] = useState<LecturerQuestion[]>([]);
  const [signalsError, setSignalsError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    try {
      setDetail((await lecturerApi.getLecture(lectureId)).lecture);
      setLoadError(null);
    } catch (err) {
      setLoadError(
        err instanceof ClientApiError && err.status === 404
          ? "Lecture not found. Lectures belong to the browser that created them."
          : errorMessage(err),
      );
    }
  }, [lectureId]);

  const refreshConfusion = useCallback(async () => {
    try {
      setConfusion(await lecturerApi.confusion(lectureId));
      setSignalsError(null);
    } catch (err) {
      setSignalsError(`Couldn't refresh live signals: ${errorMessage(err)}`);
    }
  }, [lectureId]);

  const refreshQuestions = useCallback(async () => {
    try {
      setQuestions((await lecturerApi.questions(lectureId)).questions);
      setSignalsError(null);
    } catch (err) {
      setSignalsError(`Couldn't refresh questions: ${errorMessage(err)}`);
    }
  }, [lectureId]);

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
      confusion: () => void refreshConfusion(),
      question_created: (p) =>
        setQuestions((qs) => (qs.some((q) => q.id === p.question.id) ? qs : [...qs, p.question])),
    },
    refreshAll,
  );

  useRealtimeChannel<LectureChannelEvents>(detail ? lectureChannel(detail.id) : null, {
    lecture_state: (p) => setDetail((d) => (d ? { ...d, ...p } : d)),
  });

  const applyLecture = useCallback((lecture: LecturerLecture) => {
    setDetail((d) => (d ? { ...d, ...lecture } : d));
  }, []);

  async function runAction(action: "open" | "start" | "end") {
    if (action === "end" && !window.confirm("End the lecture for everyone? This generates the AI insight report.")) return;
    setBusy(action);
    setActionError(null);
    try {
      applyLecture((await lecturerApi.lifecycle(lectureId, action)).lecture);
      void refreshConfusion();
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
      setDetail((d) => (d ? { ...d, currentSlide: slideNumber } : d));
      try {
        applyLecture((await lecturerApi.setSlide(lectureId, slideNumber)).lecture);
        void refreshConfusion();
      } catch (err) {
        setActionError(errorMessage(err));
        void loadDetail();
      } finally {
        setBusy(null);
      }
    },
    [detail, busy, lectureId, applyLecture, refreshConfusion, loadDetail],
  );

  useEffect(() => {
    if (!detail || detail.status === "ended") return;
    const current = detail.currentSlide;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") void goToSlide(current + 1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") void goToSlide(current - 1);
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
              <SlideViewer slide={slide} slideNumber={detail.currentSlide} slideCount={detail.slideCount} />
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
