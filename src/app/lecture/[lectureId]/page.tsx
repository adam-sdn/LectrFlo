"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SlideViewer } from "@/components/slide-viewer";
import dynamic from "next/dynamic";
import { AiChat } from "@/components/student/ai-chat";
import { AskLecturer, ConfusedButton } from "@/components/student/interaction-panels";
import { NotesPanel, type NotesHandle } from "@/components/student/notes-panel";
import { AppHeader, Card, ConnectionDot, ErrorNotice, LoadingScreen, StatusBadge } from "@/components/ui";
import { useCoalescedRefresh, useInterval, useRealtimeChannel } from "@/lib/client/hooks";
import { ClientApiError, errorMessage } from "@/lib/client/http";
import { createSlideUrlCache } from "@/lib/client/slide-url-cache";
import { studentApi } from "@/lib/client/student-api";
import type { LectureChannelEvents } from "@/lib/realtime";
import type { StudentLectureState } from "@/lib/types";

// Browser-only (microphone, audio); loaded on the client so the page renders without it.
const VoiceTutor = dynamic(() => import("@/components/student/voice-tutor").then((m) => m.VoiceTutor), {
  ssr: false,
});

export default function StudentLecturePage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const [state, setState] = useState<StudentLectureState | null>(null);
  const [error, setError] = useState<{ text: string; notJoined: boolean } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [urlCache] = useState(createSlideUrlCache);
  const loadVersion = useRef(0);
  const notesRef = useRef<NotesHandle>(null);
  const [questionsVersion, setQuestionsVersion] = useState(0);
  const saveVoiceNote = useCallback(async (text: string) => {
    if (!notesRef.current) throw new Error("Notes aren't loaded yet");
    await notesRef.current.append(text);
  }, []);
  const onVoiceQuestion = useCallback(() => setQuestionsVersion((v) => v + 1), []);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    try {
      const next = await studentApi.state(lectureId);
      if (version !== loadVersion.current) return;
      setState({ ...next, slides: urlCache.stabilize(next.slides) });
      setError(null);
    } catch (err) {
      if (version !== loadVersion.current) return;
      const notJoined = err instanceof ClientApiError && (err.status === 401 || err.status === 404);
      setError({ text: notJoined ? "You haven't joined this lecture on this device, or your session expired." : errorMessage(err), notJoined });
    }
  }, [lectureId, urlCache]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // The lecture channel is public, so events are only a hint to refetch (coalesced to avoid request storms).
  const requestLoad = useCoalescedRefresh(load);
  const connection = useRealtimeChannel<LectureChannelEvents>(
    state?.realtime.channel ?? null,
    {
      lecture_state: () => requestLoad(),
      slides_updated: () => requestLoad(),
      objectives_updated: () => requestLoad(),
    },
    requestLoad,
  );
  useInterval(() => void load(), state?.lecture.status === "ended" ? 120_000 : 15_000, Boolean(state));

  const onImageError = useCallback(
    (url: string) => {
      if (urlCache.invalidate(url)) requestLoad();
    },
    [urlCache, requestLoad],
  );

  async function downloadNotes() {
    setDownloading(true);
    try {
      await notesRef.current?.flush();
    } finally {
      setDownloading(false);
    }
    const link = document.createElement("a");
    link.href = studentApi.exportUrl(lectureId);
    link.download = "";
    link.click();
  }

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
            <button
              type="button"
              onClick={downloadNotes}
              disabled={downloading}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-70"
            >
              {downloading ? "Saving notes…" : "Download my notes (PDF)"}
            </button>
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
              <SlideViewer
                slide={slide}
                slideNumber={lecture.currentSlide}
                slideCount={lecture.slideCount}
                onImageError={onImageError}
              />
            )}

            {!ended && (
              <div className="grid gap-4 xl:grid-cols-2">
                <ConfusedButton lectureId={lectureId} live={live} currentSlide={lecture.currentSlide} />
                <AskLecturer lectureId={lectureId} live={live} refreshKey={questionsVersion} />
              </div>
            )}

            {objectives.length > 0 && (
              <Card title="Learning objectives">
                <ol className="space-y-2">
                  {objectives.map((o, i) => (
                    <li key={o.id} className="flex gap-3 text-sm text-slate-700">
                      <span className="flex size-6 shrink-0 items-center justify-center border border-indigo-200 bg-indigo-50 font-display text-xs font-semibold text-indigo-700">
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
            <VoiceTutor lectureId={lectureId} onSaveNote={saveVoiceNote} onQuestionSent={onVoiceQuestion} />
            <AiChat lectureId={lectureId} />
            <NotesPanel lectureId={lectureId} ref={notesRef} />
          </div>
        </div>
      </main>
    </>
  );
}
