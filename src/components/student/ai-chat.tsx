"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button, ErrorNotice, Spinner } from "@/components/ui";
import { useInterval } from "@/lib/client/hooks";
import { ClientApiError, errorMessage } from "@/lib/client/http";
import { plainMath } from "@/lib/client/plain-math";
import { studentApi } from "@/lib/client/student-api";
import type { AiMessage } from "@/lib/types";

type ChatMessage = AiMessage & { local?: "sending" };

const SUGGESTIONS = ["Explain this slide more simply", "Give me a worked example", "Why does this rule work?"];

/** Private, lecture-aware AI tutor chat backed by POST /api/student/lectures/:id/ai. */
export function AiChat({ lectureId }: { lectureId: string }) {
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
    <section className="flex h-[30rem] flex-col border border-slate-200 bg-white lg:h-[36rem]">
      <header className="flex items-start justify-between gap-3 rounded-t-2xl border-b border-indigo-100 bg-indigo-50 px-5 py-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Lecture AI</h2>
          <p className="text-xs text-slate-600">Answers using this lecture&apos;s slides and objectives.</p>
        </div>
        <span className="shrink-0 rounded-none bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-200">
          Private to you
        </span>
      </header>

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4"
        aria-live="polite"
        aria-label="Lecture AI conversation"
      >
        {loadError && <ErrorNotice message={`Couldn't load your chat: ${loadError}`} onRetry={load} />}
        {!messages && !loadError && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> Loading chat…
          </div>
        )}
        {messages?.length === 0 && !unavailable && (
          <div className="space-y-3 text-sm text-slate-600">
            <p>Stuck on something? Ask Lecture AI. Your lecturer and classmates can&apos;t see this chat.</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void ask(s)}
                  className="rounded-none bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-indigo-600"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages?.map((m) => (
          <div key={m.id} className={m.role === "student" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "student"
                  ? `max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2 text-sm ${m.status === "failed" ? "bg-rose-50 text-rose-950 ring-1 ring-rose-200" : "bg-indigo-600 text-white"}`
                  : "max-w-[90%] rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-2 text-sm text-slate-800"
              }
            >
              {m.role === "assistant" ? (
                <FormattedText text={plainMath(m.content)} />
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
              {m.status === "failed" && <p className="mt-1 text-xs font-medium text-rose-800">Not answered — try again</p>}
              {m.status === "pending" && !m.local && m === last && (
                <p className="mt-1 text-xs text-indigo-100">{gaveUpWaiting ? "No answer yet — ask again" : "Waiting for answer…"}</p>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner className="size-3" /> Lecture AI is thinking…
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 px-5 py-3">
        {unavailable && (
          <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
            Lecture AI isn&apos;t available right now (no AI provider is configured). Your notes still work.
          </p>
        )}
        {error && (
          <div className="mb-2">
            <ErrorNotice message={error.text} onRetry={error.retry ? () => void ask(error.retry!) : undefined} />
          </div>
        )}
        <form onSubmit={submit} className="flex gap-2">
          <label htmlFor="ai-input" className="sr-only">
            Ask Lecture AI
          </label>
          <input
            id="ai-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={2000}
            disabled={unavailable}
            placeholder="Ask Lecture AI about this lecture…"
            className="min-w-0 flex-1 rounded-lg border-0 px-3 py-2 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-indigo-600 focus:outline-none disabled:bg-slate-50"
          />
          <Button type="submit" disabled={sending || unavailable || !input.trim()}>
            Ask
          </Button>
        </form>
      </div>
    </section>
  );
}

/** Renders the light Markdown the model tends to use: paragraphs, bullet/numbered lists and **bold**. */
function FormattedText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  // `start` keeps the model's own numbering when a numbered list is interrupted (e.g. by sub-bullets).
  let list: { ordered: boolean; start: number; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((item, i) => <li key={i}>{inline(item)}</li>);
    blocks.push(
      list.ordered ? (
        <ol key={blocks.length} start={list.start} className="list-decimal space-y-0.5 pl-5">{items}</ol>
      ) : (
        <ul key={blocks.length} className="list-disc space-y-0.5 pl-5">{items}</ul>
      ),
    );
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, start: numbered ? Number(numbered[1]) : 1, items: [] };
      }
      list.items.push(bullet ? bullet[1] : numbered![2]);
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
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}
