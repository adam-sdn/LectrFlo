"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, Card, ErrorNotice, Spinner } from "@/components/ui";
import { useCooldown } from "@/lib/client/hooks";
import { ClientApiError, errorMessage } from "@/lib/client/http";
import { studentApi } from "@/lib/client/student-api";
import type { StudentQuestion } from "@/lib/types";

/** One-tap anonymous "I'm confused" signal on the current slide. */
export function ConfusedButton({ lectureId, live, currentSlide }: { lectureId: string; live: boolean; currentSlide: number }) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [cooldown, startCooldown] = useCooldown();

  async function send() {
    setSending(true);
    setMessage(null);
    try {
      const res = await studentApi.confused(lectureId);
      startCooldown(res.cooldownSeconds);
      setMessage({ tone: "ok", text: `Got it — your lecturer sees an anonymous count for slide ${res.slideNumber}.` });
    } catch (err) {
      if (err instanceof ClientApiError && err.code === "cooldown") {
        startCooldown(err.retryAfterSeconds ?? 30);
        setMessage({ tone: "ok", text: "Your signal for this moment is already registered." });
      } else {
        setMessage({ tone: "error", text: errorMessage(err) });
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <button
        type="button"
        onClick={send}
        disabled={!live || sending || cooldown > 0}
        className="flex w-full items-center justify-center gap-3 rounded-xl bg-amber-400 px-6 py-4 text-lg font-bold text-amber-950 shadow-sm transition hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        {sending ? <Spinner className="size-5" /> : <span aria-hidden>🤔</span>}
        {cooldown > 0 ? `Signal sent (${cooldown}s)` : "I'm confused"}
      </button>
      <p className="mt-2 text-center text-xs text-slate-500" aria-live="polite">
        {message ? (
          <span className={message.tone === "ok" ? "text-emerald-700" : "text-rose-700"}>{message.text}</span>
        ) : live ? (
          `Anonymous. Tells your lecturer slide ${currentSlide} needs another look — no need to type a question.`
        ) : (
          "Available while the lecture is live."
        )}
      </p>
    </div>
  );
}

/** Questions routed to the human lecturer (anonymous to them). */
export function AskLecturer({ lectureId, live }: { lectureId: string; live: boolean }) {
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    try {
      setQuestions((await studentApi.questions(lectureId)).questions);
    } catch {
      // The list is secondary; sending still works.
    }
  }, [lectureId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return setError("Type your question first.");
    setSending(true);
    setError(null);
    setSent(false);
    try {
      const { question } = await studentApi.ask(lectureId, text);
      setQuestions((qs) => [...qs, question]);
      setBody("");
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <Card title="💬 Ask the lecturer" action={<span className="text-xs text-slate-500">Anonymous</span>}>
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor="lecturer-question" className="sr-only">
          Question for the lecturer
        </label>
        <input
          id="lecturer-question"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setSent(false);
          }}
          maxLength={1000}
          disabled={!live}
          placeholder={live ? "Ask a question about this slide…" : "Available while the lecture is live"}
          className="min-w-0 flex-1 rounded-lg border-0 px-3 py-2 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-indigo-600 focus:outline-none disabled:bg-slate-50"
        />
        <Button type="submit" variant="secondary" disabled={!live || sending}>
          {sending ? <Spinner /> : "Send"}
        </Button>
      </form>
      <div className="mt-2 text-xs" aria-live="polite">
        {error && <ErrorNotice message={error} />}
        {sent && <span className="text-emerald-700">Sent to your lecturer.</span>}
      </div>
      {questions.length > 0 && (
        <ul className="mt-3 space-y-1.5" aria-label="Your questions">
          {[...questions].reverse().slice(0, 4).map((q) => (
            <li key={q.id} className="flex items-start justify-between gap-2 text-sm">
              <span className="text-slate-700">{q.body}</span>
              <span className={`shrink-0 text-xs ${q.status === "answered" ? "text-emerald-700" : "text-slate-400"}`}>
                {q.status === "answered" ? "Answered" : `Slide ${q.slideNumber ?? "–"}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
