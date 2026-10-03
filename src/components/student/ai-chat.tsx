"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button, ErrorNotice, Spinner } from "@/components/ui";
import { useInterval } from "@/lib/client/hooks";
import { ClientApiError, errorMessage } from "@/lib/client/http";
import { studentApi } from "@/lib/client/student-api";
import type { AiMessage } from "@/lib/types";

type ChatMessage = AiMessage & { local?: "sending" };

const SUGGESTIONS = ["Explain this slide more simply", "Give me a worked example", "Why does this rule work?"];

/** Private, lecture-aware AI tutor chat backed by POST /api/student/lectures/:id/ai. */
export function AiChat({ lectureId, className = "h-[30rem] lg:h-[36rem]" }: { lectureId: string; className?: string }) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ text: string; retry?: string } | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [gaveUpWaiting, setGaveUpWaiting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setMessages((await studentApi.aiHistory(lectureId)).messages);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, [lectureId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Scroll the message list itself (never the page) to the newest message.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, sending]);

  // A reply can still be in progress after a page refresh: poll until it lands (up to ~2 minutes).
  const last = messages?.at(-1);
  const waitingForReply = !sending && last?.role === "student" && last.status === "pending" && !last.local;
  useInterval(
    async () => {
      try {
        const { messages: fresh } = await studentApi.aiHistory(lectureId);
        setMessages(fresh);
        const newest = fresh.at(-1);
        if (newest?.status === "pending" && Date.now() - Date.parse(newest.createdAt) > 120_000) setGaveUpWaiting(true);
      } catch {
        // Try again on the next tick.
      }
    },
    3000,
    waitingForReply && !gaveUpWaiting,
  );

  async function ask(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    const pending: ChatMessage = {
      id: `local-${messages?.length ?? 0}`,
      role: "student",
      content: message,
      slideNumber: null,
      status: "pending",
      createdAt: new Date().toISOString(),
      local: "sending",
    };
    setMessages((m) => [...(m ?? []), pending]);
    setInput("");
    try {
      const res = await studentApi.askAi(lectureId, message);
      setMessages((m) => [...(m ?? []).filter((x) => x.id !== pending.id), ...res.messages]);
    } catch (err) {
      if (err instanceof ClientApiError && err.code === "ai_unavailable") {
        setUnavailable(true);
        setMessages((m) => (m ?? []).filter((x) => x.id !== pending.id));
        setInput(message);
      } else if (err instanceof ClientApiError && err.code === "ai_failed") {
        const failed = (err.details as { message?: AiMessage } | undefined)?.message;
        setMessages((m) => [...(m ?? []).filter((x) => x.id !== pending.id), failed ?? { ...pending, local: undefined, status: "failed" }]);
        setError({ text: err.message, retry: message });
      } else {
        setMessages((m) => (m ?? []).filter((x) => x.id !== pending.id));
        setInput(message);
        setError({ text: errorMessage(err) });
      }
    } finally {
      setSending(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  return (
    <section className={`flex flex-col overflow-hidden rounded-2xl border border-ai/20 bg-surface ${className}`}>
      <header className="relative flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-ai-bright/50 to-transparent" aria-hidden />
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ai/15 text-sm text-ai-bright ring-1 ring-inset ring-ai/30" aria-hidden>
            ✦
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-fg">Lecture AI</h2>
            <p className="truncate text-xs text-muted">Answers grounded in this lecture&apos;s slides</p>
          </div>
        </div>
        <span className="shrink-0 rounded-md border border-line px-2 py-0.5 text-[11px] text-muted">Private to you</span>
      </header>

      <div
        ref={listRef}
        className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5"
        aria-live="polite"
        aria-label="Lecture AI conversation"
      >
        {loadError && <ErrorNotice message={`Couldn't load your chat: ${loadError}`} onRetry={load} />}
        {!messages && !loadError && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> Loading chat…
          </div>
        )}
        {messages?.length === 0 && !unavailable && (
          <div className="flex h-full animate-fade-in flex-col justify-end gap-4">
            <div>
              <p className="text-base font-medium text-fg">Stuck on something?</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Ask about anything in this lecture. Your lecturer and classmates can&apos;t see this chat.
              </p>
            </div>
            <div className="flex flex-col items-start gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void ask(s)}
                  className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-left text-sm text-fg-2 transition hover:border-ai/40 hover:bg-ai/[0.08] hover:text-fg focus-visible:outline-2 focus-visible:outline-ai-bright"
                >
                  <span className="mr-2 text-ai-bright" aria-hidden>
                    ✦
                  </span>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages?.map((m) => (
          <div key={m.id} className={`flex animate-fade-up ${m.role === "student" ? "justify-end" : "justify-start"}`}>
            <div
              className={
                m.role === "student"
                  ? `max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm leading-relaxed ${m.status === "failed" ? "bg-confused/[0.08] text-[#fecdd3] ring-1 ring-inset ring-confused/25" : "bg-surface-3 text-fg"}`
                  : "max-w-[92%] rounded-2xl rounded-bl-md border border-ai/20 bg-ai/[0.07] px-4 py-3 text-sm text-fg-2"
              }
            >
              {m.role === "assistant" && (
                <p className="mb-1.5 text-[11px] font-medium text-ai-bright">
                  <span aria-hidden>✦ </span>Lecture AI
                </p>
              )}
              {m.role === "assistant" ? <FormattedText text={m.content} /> : <p className="whitespace-pre-wrap">{m.content}</p>}
              {m.status === "failed" && <p className="mt-1 text-xs text-confused">Not answered — try again</p>}
              {m.status === "pending" && !m.local && m === last && (
                <p className="mt-1 text-xs text-muted">{gaveUpWaiting ? "No answer yet — ask again" : "Waiting for answer…"}</p>
              )}
            </div>
          </div>
        ))}
        {(sending || (waitingForReply && !gaveUpWaiting)) && (
          <div className="flex animate-fade-up justify-start" role="status" aria-label="Lecture AI is thinking">
            <div className="flex items-center gap-3 rounded-2xl rounded-bl-md border border-ai/20 bg-ai/[0.07] px-4 py-3">
              <span className="flex gap-1" aria-hidden>
                {[0, 150, 300].map((d) => (
                  <span key={d} className="size-1.5 animate-typing rounded-full bg-ai-bright" style={{ animationDelay: `${d}ms` }} />
                ))}
              </span>
              <span className="text-xs text-muted">Reading the lecture…</span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-line p-3">
        {unavailable && (
          <p className="mb-2 rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-muted ring-1 ring-inset ring-line">
            Lecture AI isn&apos;t available right now (no AI provider is configured). Your notes still work.
          </p>
        )}
        {error && (
          <div className="mb-2">
            <ErrorNotice message={error.text} onRetry={error.retry ? () => void ask(error.retry!) : undefined} />
          </div>
        )}
        <form
          onSubmit={submit}
          className="flex items-center gap-2 rounded-xl bg-canvas/60 p-1.5 ring-1 ring-line-strong transition focus-within:ring-2 focus-within:ring-ai"
        >
          <label htmlFor="ai-input" className="sr-only">
            Ask Lecture AI
          </label>
          <input
            id="ai-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={2000}
            disabled={unavailable}
            placeholder="Ask about this lecture…"
            className="min-w-0 flex-1 bg-transparent px-2.5 py-1.5 text-sm text-fg placeholder:text-faint focus:outline-none disabled:opacity-60"
          />
          <Button type="submit" disabled={sending || unavailable || !input.trim()} className="px-3.5 py-1.5" aria-label="Ask Lecture AI">
            Ask <span aria-hidden>↑</span>
          </Button>
        </form>
      </div>
    </section>
  );
}

/** Renders the light Markdown the model tends to use: paragraphs, bullet/numbered lists and **bold**. */
function FormattedText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((item, i) => <li key={i}>{inline(item)}</li>);
    blocks.push(
      list.ordered ? (
        <ol key={blocks.length} className="list-decimal space-y-0.5 pl-5">{items}</ol>
      ) : (
        <ul key={blocks.length} className="list-disc space-y-0.5 pl-5">{items}</ul>
      ),
    );
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)![1]);
    } else {
      flush();
      if (line) blocks.push(<p key={blocks.length}>{inline(line.replace(/^#+\s*/, ""))}</p>);
    }
  }
  flush();
  return <div className="space-y-2 leading-relaxed">{blocks}</div>;
}

function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="font-medium text-fg">{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}
