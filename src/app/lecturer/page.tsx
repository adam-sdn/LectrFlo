"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppHeader, Button, Card, ErrorNotice, Spinner, StatusBadge } from "@/components/ui";
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
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">Your lectures</h1>
        <p className="mt-1 text-sm text-slate-600">Open a lecture to run it live, or create the demo lecture.</p>

        <Card className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Demo lecture</p>
              <p className="mt-1 font-semibold">{DEMO_LECTURE.title}</p>
              <p className="text-sm text-slate-600">6 slides · learning objectives · slide text for Lecture AI</p>
            </div>
            <Button onClick={createDemo} disabled={creating !== null}>
              {creating ? (
                <>
                  <Spinner /> {creating}
                </>
              ) : (
                "Create demo lecture"
              )}
            </Button>
          </div>
          {createError && (
            <div className="mt-4">
              <ErrorNotice message={createError} onRetry={createDemo} />
            </div>
          )}
        </Card>

        <div className="mt-6 space-y-3">
          {loadError && <ErrorNotice message={loadError} onRetry={load} />}
          {!lectures && !loadError && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner /> Loading lectures…
            </div>
          )}
          {lectures?.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              No lectures yet. Create the demo lecture to get started.
            </p>
          )}
          {lectures?.map((lecture) => (
            <Link
              key={lecture.id}
              href={`/lecturer/${lecture.id}`}
              className="flex items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 ring-1 ring-slate-200 transition hover:ring-indigo-400 focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{lecture.title}</p>
                <p className="text-sm text-slate-500">
                  {lecture.module ? `${lecture.module} · ` : ""}
                  {lecture.slideCount} slides · code <span className="font-mono font-semibold">{lecture.joinCode}</span>
                </p>
              </div>
              <StatusBadge status={lecture.status} />
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
