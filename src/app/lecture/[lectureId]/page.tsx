"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SlideViewer } from "@/components/slide-viewer";
import { AiChat } from "@/components/student/ai-chat";
import { AskLecturer, ConfusedButton } from "@/components/student/interaction-panels";
import { NotesPanel } from "@/components/student/notes-panel";
import { AppHeader, Card, ConnectionDot, ErrorNotice, LoadingScreen, StatusBadge } from "@/components/ui";
import { useInterval, useRealtimeChannel } from "@/lib/client/hooks";
import { ClientApiError, errorMessage } from "@/lib/client/http";
import { studentApi } from "@/lib/client/student-api";
import type { LectureChannelEvents } from "@/lib/realtime";
import type { StudentLectureState } from "@/lib/types";

export default function StudentLecturePage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const [state, setState] = useState<StudentLectureState | null>(null);
  const [error, setError] = useState<{ text: string; notJoined: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      setState(await studentApi.state(lectureId));
      setError(null);
    } catch (err) {
      const notJoined = err instanceof ClientApiError && (err.status === 401 || err.status === 404);
      setError({ text: notJoined ? "You haven't joined this lecture on this device, or your session expired." : errorMessage(err), notJoined });
    }
  }, [lectureId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Events are hints: refetch to pick up newly revealed slide URLs. Polling covers missed events.
  const connection = useRealtimeChannel<LectureChannelEvents>(
    state?.realtime.channel ?? null,
    {
      lecture_state: (p) => {
        setState((s) => (s ? { ...s, lecture: { ...s.lecture, ...p } } : s));
        void load();
      },
      slides_updated: () => void load(),
      objectives_updated: () => void load(),
    },
    load,
  );
  useInterval(() => void load(), state?.lecture.status === "ended" ? 120_000 : 15_000, Boolean(state));

  if (!state) {
    return (
      <>
        <AppHeader role="Student" />
        {error ? (
          <main className="mx-auto max-w-xl space-y-4 px-4 py-16">
            <ErrorNotice message={error.text} onRetry={error.notJoined ? undefined : load} />
            {error.notJoined && (
              <Link href="/join" className="inline-block text-sm font-semibold text-indigo-600">
                Join with a code →
              </Link>
            )}
          </main>
        ) : (
          <LoadingScreen label="Joining lecture…" />
        )}
      </>
    );
  }

  const { lecture, objectives } = state;
  const live = lecture.status === "live";
  const ended = lecture.status === "ended";
  const slide = state.slides.find((s) => s.slideNumber === lecture.currentSlide);

  return (
    <>
      <AppHeader role="Student">
        {!ended && <ConnectionDot status={connection} />}
        <span className="text-sm text-slate-600">
          Joined as <span className="font-semibold text-slate-900">{state.participant.displayName}</span>
        </span>
      </AppHeader>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-indigo-600">
              {[lecture.module, lecture.lecturerName].filter(Boolean).join(" · ") || "Lecture"}
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{lecture.title}</h1>
          </div>
          <StatusBadge status={lecture.status} />
        </div>

        {error && (
          <div className="mb-4">
            <ErrorNotice message={`Lost connection to the lecture: ${error.text}`} onRetry={load} />
          </div>
        )}

        {ended && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900 px-5 py-4 text-white">
            <div>
              <p className="font-semibold">This lecture has ended.</p>
              <p className="text-sm text-slate-300">Your notes are saved. You can keep asking Lecture AI to review.</p>
            </div>
            <a
              href={studentApi.exportUrl(lectureId)}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Download my notes
            </a>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            {lecture.status === "lobby" || lecture.status === "draft" ? (
              <div className="flex aspect-video flex-col items-center justify-center rounded-2xl bg-indigo-950 p-8 text-center text-white">
                <p className="text-sm font-semibold uppercase tracking-wide text-indigo-300">You&apos;re in</p>
                <p className="mt-2 text-2xl font-bold">Waiting for the lecturer to start…</p>
                <p className="mt-2 text-sm text-indigo-200">The first slide will appear here automatically.</p>
              </div>
            ) : (
              <SlideViewer slide={slide} slideNumber={lecture.currentSlide} slideCount={lecture.slideCount} />
            )}

            {!ended && (
              <div className="grid gap-4 xl:grid-cols-2">
                <ConfusedButton lectureId={lectureId} live={live} currentSlide={lecture.currentSlide} />
                <AskLecturer lectureId={lectureId} live={live} />
              </div>
            )}

            {objectives.length > 0 && (
              <Card title="🎯 Learning objectives">
                <ol className="space-y-2">
                  {objectives.map((o, i) => (
                    <li key={o.id} className="flex gap-3 text-sm text-slate-700">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">
                        {i + 1}
                      </span>
                      {o.text}
                    </li>
                  ))}
                </ol>
              </Card>
            )}
          </div>

          <div className="space-y-4 lg:col-span-5">
            <AiChat lectureId={lectureId} />
            <NotesPanel lectureId={lectureId} />
          </div>
        </div>
      </main>
    </>
  );
}
