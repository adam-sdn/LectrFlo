"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Card, ErrorNotice, Spinner } from "@/components/ui";
import { errorMessage } from "@/lib/client/http";
import { studentApi } from "@/lib/client/student-api";

type SaveState = "saved" | "dirty" | "saving" | "error";
const AUTOSAVE_MS = 800;

export interface NotesHandle {
  /** Saves any pending edits and resolves once the server has them (or the save failed). */
  flush: () => Promise<void>;
}

/** Private notes, autosaved to the server (the source of truth) shortly after typing stops. */
export function NotesPanel({ lectureId, ref, className = "" }: { lectureId: string; ref?: Ref<NotesHandle>; className?: string }) {
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);

  const latest = useRef("");
  const saved = useRef("");
  const running = useRef<Promise<void> | null>(null);
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

  const save = useCallback((): Promise<void> => {
    if (timer.current) clearTimeout(timer.current);
    if (running.current) return running.current;
    if (latest.current === saved.current) return Promise.resolve();
    const run = (async () => {
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
    })().finally(() => {
      running.current = null;
    });
    running.current = run;
    return run;
  }, [lectureId]);

  useImperativeHandle(ref, () => ({ flush: save }), [save]);

  // Pick up edits made in another tab, but never over unsaved local text.
  useEffect(() => {
    async function refresh() {
      if (document.visibilityState !== "visible" || running.current || latest.current !== saved.current) return;
      const before = latest.current;
      try {
        const { notes } = await studentApi.notes(lectureId);
        if (running.current || latest.current !== before || notes.content === before) return;
        latest.current = notes.content;
        saved.current = notes.content;
        setContent(notes.content);
      } catch {
        // Keep the current text; the next focus retries.
      }
    }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
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
    saved: <span className="text-muted">✓ Saved</span>,
    dirty: <span className="text-faint">Editing…</span>,
    saving: (
      <span className="flex items-center gap-1.5 text-muted">
        <Spinner className="size-3" /> Saving…
      </span>
    ),
    error: <span className="text-confused">Not saved</span>,
  }[saveState];

  return (
    <Card
      className={className}
      title={
        <span className="flex items-center gap-2">
          Private notes <span className="rounded-md border border-line px-1.5 py-0.5 text-[11px] font-normal text-muted">Only you</span>
        </span>
      }
      action={loaded && <span className="text-xs" aria-live="polite">{status}</span>}
    >
      {loadError ? (
        <ErrorNotice message={`Couldn't load your notes: ${loadError}`} onRetry={load} />
      ) : !loaded ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted">
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
            className="scrollbar-thin h-64 w-full resize-y rounded-xl border-0 bg-canvas/60 p-4 text-sm leading-relaxed text-fg ring-1 ring-line-strong transition placeholder:text-faint focus:ring-2 focus:ring-ai focus:outline-none lg:h-[26rem]"
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
