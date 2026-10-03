"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, ErrorNotice, Spinner } from "@/components/ui";
import { errorMessage } from "@/lib/client/http";
import { studentApi } from "@/lib/client/student-api";

type SaveState = "saved" | "dirty" | "saving" | "error";
const AUTOSAVE_MS = 800;

/** Private notes, autosaved to the server (the source of truth) shortly after typing stops. */
export function NotesPanel({ lectureId }: { lectureId: string }) {
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);

  const latest = useRef("");
  const saved = useRef("");
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const { notes } = await studentApi.notes(lectureId);
      latest.current = notes.content;
      saved.current = notes.content;
      setContent(notes.content);
      setLoaded(true);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, [lectureId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const save = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      // Keep going until the server has the latest text (typing may continue mid-request).
      while (latest.current !== saved.current) {
        const value = latest.current;
        setSaveState("saving");
        try {
          await studentApi.saveNotes(lectureId, value);
        } catch (err) {
          setSaveError(errorMessage(err));
          setSaveState("error");
          return;
        }
        saved.current = value;
        setSaveError(null);
      }
      setSaveState("saved");
    } finally {
      inFlight.current = false;
    }
  }, [lectureId]);

  function onChange(value: string) {
    latest.current = value;
    setContent(value);
    setSaveState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
  }

  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      if (latest.current !== saved.current) e.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const status = {
    saved: <span className="text-emerald-700">Saved</span>,
    dirty: <span className="text-slate-500">Unsaved changes…</span>,
    saving: (
      <span className="flex items-center gap-1.5 text-slate-500">
        <Spinner className="size-3" /> Saving…
      </span>
    ),
    error: <span className="text-rose-700">Not saved</span>,
  }[saveState];

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          📝 My notes <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">Private</span>
        </span>
      }
      action={loaded && <span className="text-xs" aria-live="polite">{status}</span>}
    >
      {loadError ? (
        <ErrorNotice message={`Couldn't load your notes: ${loadError}`} onRetry={load} />
      ) : !loaded ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading notes…
        </div>
      ) : (
        <>
          <label htmlFor="notes" className="sr-only">
            My notes
          </label>
          <textarea
            id="notes"
            value={content}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => void save()}
            placeholder="Type your notes here. They save automatically and only you can see them."
            maxLength={100000}
            className="h-48 w-full resize-y rounded-xl border-0 p-3 text-sm leading-relaxed ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-600 focus:outline-none lg:h-56"
          />
          {saveState === "error" && saveError && (
            <div className="mt-2">
              <ErrorNotice message={`Your latest notes aren't saved: ${saveError}`} onRetry={() => void save()} />
            </div>
          )}
        </>
      )}
    </Card>
  );
}
