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
      setMessage({ tone: "ok", text: `Your lecturer sees an anonymous signal for slide ${res.slideNumber}.` });
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

  const sent = cooldown > 0;
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <button
        type="button"
        onClick={send}
        disabled={!live || sending || sent}
        className={`relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl px-6 py-4 text-base font-medium transition duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-confused disabled:cursor-not-allowed ${
          sent
            ? "animate-press bg-confused/[0.08] text-confused ring-1 ring-inset ring-confused/30"
            : live
              ? "bg-confused/[0.14] text-[#fecdd3] ring-1 ring-inset ring-confused/45 hover:-translate-y-px hover:bg-confused/[0.22] hover:shadow-[0_10px_30px_-14px_rgb(251_113_133/0.8)] active:scale-[0.98]"
              : "bg-white/[0.04] text-faint ring-1 ring-inset ring-line"
        }`}
      >
        {sent && <span className="pointer-events-none absolute inset-0 animate-ripple rounded-xl bg-confused/30" aria-hidden />}
        {sending ? (
          <Spinner className="size-5" />
        ) : sent ? (
          <span aria-hidden>✓</span>
        ) : (
          <span aria-hidden className="flex size-6 items-center justify-center rounded-full bg-confused text-sm font-semibold text-[#2a0a12]">?</span>
        )}
        {sent ? "Confusion signal sent" : "I'm Confused"}
        {sent && <span className="text-xs font-normal tabular-nums text-confused/70">{cooldown}s</span>}
      </button>
      <p className="mt-2.5 min-h-4 text-center text-xs text-muted" aria-live="polite">
        {message ? (
          <span className={`inline-block animate-fade-in ${message.tone === "ok" ? "text-fg-2" : "text-confused"}`}>{message.text}</span>
        ) : live ? (
          `Anonymous · tells your lecturer slide ${currentSlide} needs another look.`
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
    <Card title="Ask the lecturer" action={<span className="text-xs text-muted">Anonymous</span>}>
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
          className="min-w-0 flex-1 rounded-xl border-0 bg-canvas/60 px-3.5 py-2.5 text-sm text-fg ring-1 ring-line-strong transition placeholder:text-faint focus:ring-2 focus:ring-ai focus:outline-none disabled:opacity-60"
        />
        <Button type="submit" variant="secondary" disabled={!live || sending}>
          {sending ? <Spinner /> : "Send"}
        </Button>
      </form>
      <div className="mt-2 text-xs" aria-live="polite">
        {error && <ErrorNotice message={error} />}
        {sent && <span className="inline-block animate-fade-in text-success">✓ Sent to your lecturer</span>}
      </div>
      {questions.length > 0 && (
        <ul className="mt-3 space-y-1.5" aria-label="Your questions">
          {[...questions].reverse().slice(0, 4).map((q) => (
            <li key={q.id} className="flex animate-fade-in items-start justify-between gap-2 text-sm">
              <span className="text-fg-2">{q.body}</span>
              <span className={`shrink-0 text-xs ${q.status === "answered" ? "text-success" : "text-faint"}`}>
                {q.status === "answered" ? "Answered" : `Slide ${q.slideNumber ?? "–"}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
