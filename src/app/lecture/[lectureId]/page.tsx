"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SlideViewer } from "@/components/slide-viewer";
import { AiChat } from "@/components/student/ai-chat";
import { AskLecturer, ConfusedButton } from "@/components/student/interaction-panels";
import { NotesPanel, type NotesHandle } from "@/components/student/notes-panel";
import { AppHeader, Button, Card, ConnectionDot, ErrorNotice, LoadingScreen, StatusBadge, splitTitle } from "@/components/ui";
import { useCoalescedRefresh, useInterval, useRealtimeChannel } from "@/lib/client/hooks";
import { ClientApiError, errorMessage } from "@/lib/client/http";
import { createSlideUrlCache } from "@/lib/client/slide-url-cache";
import { studentApi } from "@/lib/client/student-api";
import type { LectureChannelEvents } from "@/lib/realtime";
import type { StudentLectureState } from "@/lib/types";

export default function StudentLecturePage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const [state, setState] = useState<StudentLectureState | null>(null);
  const [error, setError] = useState<{ text: string; notJoined: boolean } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [tab, setTab] = useState<"ai" | "notes">("ai");
  const [urlCache] = useState(createSlideUrlCache);
  const loadVersion = useRef(0);
  const notesRef = useRef<NotesHandle>(null);

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
              <Link href="/join" className="inline-block text-sm font-medium text-ai-bright hover:text-fg">
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
  const { course, topic } = splitTitle(lecture.title);
  const context = [lecture.module, lecture.lecturerName].filter(Boolean).join(" · ");

  return (
    <>
      <AppHeader
        role="Student"
        title={
          <>
            <p className="min-w-0 truncate text-sm">
              <span className="font-medium text-fg">{course}</span>
              {topic && <span className="text-muted"> · {topic}</span>}
            </p>
            <StatusBadge status={lecture.status} />
          </>
        }
      >
        {!ended && <ConnectionDot status={connection} />}
        <span className="min-w-0 truncate text-sm text-muted">
          <span className="hidden sm:inline">Joined as </span>
          <span className="font-medium text-fg">{state.participant.displayName}</span>
        </span>
      </AppHeader>

      <main className="mx-auto max-w-[1440px] px-3 py-4 sm:px-6 sm:py-6">
        {/* Lecture context on small screens (the header shows it from md up). */}
        <div className="mb-4 flex items-start justify-between gap-3 px-1 md:hidden">
          <div className="min-w-0">
            {context && <p className="truncate text-xs text-muted">{context}</p>}
            <h1 className="text-lg leading-tight font-semibold tracking-tight">
              {course}
              {topic && <span className="text-muted"> · {topic}</span>}
            </h1>
          </div>
          <StatusBadge status={lecture.status} />
        </div>

        {error && (
          <div className="mb-4">
            <ErrorNotice message={`Lost connection to the lecture: ${error.text}`} onRetry={load} />
          </div>
        )}

        {ended && (
          <div className="mb-4 flex animate-fade-up flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-5 py-4">
            <div>
              <p className="font-medium text-fg">This lecture has ended.</p>
              <p className="text-sm text-muted">Your notes are saved. You can keep asking Lecture AI to review.</p>
            </div>
            <Button variant="secondary" onClick={downloadNotes} disabled={downloading}>
              {downloading ? "Saving notes…" : "Download my notes"}
            </Button>
          </div>
        )}

        {/* Mobile order: slide, confused, AI/notes, ask, objectives. Desktop: slide column + sticky side panel. */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_26rem] lg:grid-rows-[auto_auto_1fr] lg:gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_28rem]">
          <div className="order-1 lg:col-span-2 lg:col-start-1 lg:row-start-1">
            {lecture.status === "lobby" || lecture.status === "draft" ? (
              <div className="relative flex aspect-video flex-col items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface p-8 text-center">
                <div className="pointer-events-none absolute inset-0" aria-hidden>
                  <div className="ambient-glow animate-ambient" />
                </div>
                <span className="relative flex size-12 items-center justify-center" aria-hidden>
                  <span className="absolute inset-0 animate-ping rounded-full bg-ai/20 [animation-duration:2.4s]" />
                  <span className="size-3 rounded-full bg-ai-bright" />
                </span>
                <p className="relative mt-5 text-xs font-medium tracking-[0.16em] text-ai-bright uppercase">You&apos;re in</p>
                <p className="relative mt-2 text-xl font-semibold tracking-tight text-fg sm:text-2xl">Waiting for the lecture to start…</p>
                <p className="relative mt-2 text-sm text-muted">The first slide will appear here automatically.</p>
              </div>
            ) : (
              <SlideViewer
                slide={slide}
                slideNumber={lecture.currentSlide}
                slideCount={lecture.slideCount}
                onImageError={onImageError}
              />
            )}
          </div>

          {!ended && (
            <>
              <div className="order-2 lg:col-start-1 lg:row-start-2 lg:[&>*]:h-full">
                <ConfusedButton lectureId={lectureId} live={live} currentSlide={lecture.currentSlide} />
              </div>
              <div className="order-4 lg:col-start-2 lg:row-start-2 lg:[&>*]:h-full">
                <AskLecturer lectureId={lectureId} live={live} />
              </div>
            </>
          )}

          {objectives.length > 0 && (
            <Card title="Learning objectives" className="order-5 lg:col-span-2 lg:col-start-1 lg:row-start-3 lg:self-start">
              <ol className="space-y-2.5">
                {objectives.map((o, i) => (
                  <li key={o.id} className="flex gap-3 text-sm text-fg-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-xs text-muted">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{o.text}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <div className="order-3 lg:sticky lg:top-20 lg:col-start-3 lg:row-span-3 lg:row-start-1 lg:self-start">
            <div role="tablist" aria-label="Study tools" className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1">
              <TabButton active={tab === "ai"} onClick={() => setTab("ai")} controls="panel-ai" activeClass="bg-ai/15 text-fg ring-1 ring-inset ring-ai/30">
                <span className="text-ai-bright" aria-hidden>
                  ✦
                </span>
                Lecture AI
              </TabButton>
              <TabButton active={tab === "notes"} onClick={() => setTab("notes")} controls="panel-notes" activeClass="bg-surface-3 text-fg ring-1 ring-inset ring-line-strong">
                Private notes
              </TabButton>
            </div>
            {/* Both panels stay mounted so chat state and pending note saves survive tab switches. */}
            <div id="panel-ai" role="tabpanel" hidden={tab !== "ai"} className="animate-fade-in">
              <AiChat lectureId={lectureId} className="h-[32rem] lg:h-[calc(100dvh-10.5rem)] lg:min-h-[28rem]" />
            </div>
            <div id="panel-notes" role="tabpanel" hidden={tab !== "notes"} className="animate-fade-in">
              <NotesPanel lectureId={lectureId} ref={notesRef} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function TabButton({
  active,
  onClick,
  controls,
  activeClass,
  children,
}: {
  active: boolean;
  onClick: () => void;
  controls: string;
  activeClass: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition duration-200 focus-visible:outline-2 focus-visible:outline-ai-bright ${active ? activeClass : "text-muted hover:text-fg"}`}
    >
      {children}
    </button>
  );
}
