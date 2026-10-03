"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppHeader, Button, ErrorNotice, Spinner, StatusBadge } from "@/components/ui";
import { DEMO_LECTURE, createDemoLecture } from "@/lib/client/demo-lecture";
import { errorMessage } from "@/lib/client/http";
import { lecturerApi } from "@/lib/client/lecturer-api";
import type { LecturerLecture } from "@/lib/types";

export default function LecturerHome() {
  const router = useRouter();
  const [lectures, setLectures] = useState<LecturerLecture[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setLectures((await lecturerApi.listLectures()).lectures);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    // Initial load; setState happens after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function createDemo() {
    setCreateError(null);
    setCreating("Starting…");
    try {
      const id = await createDemoLecture(setCreating);
      router.push(`/lecturer/${id}`);
    } catch (err) {
      setCreateError(errorMessage(err));
      setCreating(null);
      void load();
    }
  }

  return (
    <>
      <AppHeader role="Lecturer" />
      <main className="relative mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="animate-fade-up">
          <h1 className="text-3xl font-semibold tracking-[-0.025em] text-fg">Start a lecture</h1>
          <p className="mt-2 text-sm text-muted">Create the demo lecture, or reopen one you&apos;ve already prepared.</p>
        </div>

        <section
          className="relative mt-8 animate-fade-up overflow-hidden rounded-3xl border border-line-strong bg-surface p-6 sm:p-8"
          style={{ animationDelay: "60ms" }}
        >
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="ambient-glow opacity-60" />
          </div>
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-[0.16em] text-ai-bright uppercase">Demo lecture</p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-fg">{DEMO_LECTURE.title}</p>
              <p className="mt-1 text-sm text-muted">{DEMO_LECTURE.module} · 6 slides · learning objectives · slide text for Lecture AI</p>
            </div>
            <Button onClick={createDemo} disabled={creating !== null} className="px-5 py-3">
              {creating ? (
                <>
                  <Spinner /> {creating}
                </>
              ) : (
                <>
                  Create demo lecture <span aria-hidden>→</span>
                </>
              )}
            </Button>
          </div>
          {createError && (
            <div className="relative mt-4">
              <ErrorNotice message={createError} onRetry={createDemo} />
            </div>
          )}
        </section>

        <div className="mt-10 animate-fade-up" style={{ animationDelay: "120ms" }}>
          <h2 className="text-[11px] font-medium tracking-[0.16em] text-muted uppercase">Your lectures</h2>
          <div className="mt-3 space-y-2">
            {loadError && <ErrorNotice message={loadError} onRetry={load} />}
            {!lectures && !loadError && (
              <div className="flex items-center gap-2 py-4 text-sm text-muted">
                <Spinner /> Loading lectures…
              </div>
            )}
            {lectures?.length === 0 && (
              <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-sm text-muted">
                No lectures yet. Create the demo lecture to get started.
              </p>
            )}
            {lectures?.map((lecture) => (
              <Link
                key={lecture.id}
                href={`/lecturer/${lecture.id}`}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-4 transition duration-200 hover:-translate-y-px hover:border-line-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ai-bright"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-fg">{lecture.title}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {lecture.module ? `${lecture.module} · ` : ""}
                    {lecture.slideCount} slides · code <span className="font-mono text-fg-2">{lecture.joinCode}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge status={lecture.status} />
                  <span className="text-muted transition group-hover:translate-x-0.5 group-hover:text-fg" aria-hidden>
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
