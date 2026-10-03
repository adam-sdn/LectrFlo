"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { Button, ErrorNotice, Logo, Spinner, StatusBadge } from "@/components/ui";
import { ClientApiError, errorMessage } from "@/lib/client/http";
import { studentApi } from "@/lib/client/student-api";
import type { JoinPreview } from "@/lib/types";

const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;
const normalize = (code: string) => code.toUpperCase().replace(/[\s-]/g, "");

function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(() => normalize(params.get("code") ?? ""));
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<{
    code: string;
    lecture?: JoinPreview;
    joinedAs?: string;
    error?: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanCode = normalize(code);
  const codeComplete = CODE_PATTERN.test(cleanCode);

  useEffect(() => {
    if (!codeComplete) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      studentApi
        .preview(cleanCode)
        .then(async ({ lecture }) => {
          // This browser may already have a participant session for this lecture (cookie).
          const joinedAs = await studentApi
            .state(lecture.lectureId)
            .then((state) => state.participant.displayName)
            .catch(() => undefined);
          if (!cancelled) setPreview({ code: cleanCode, lecture, joinedAs });
        })
        .catch((err) => !cancelled && setPreview({ code: cleanCode, error: errorMessage(err) }));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cleanCode, codeComplete]);

  const currentPreview = preview?.code === cleanCode ? preview : null;
  const joinedAs = currentPreview?.lecture && currentPreview.joinedAs;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!cleanCode) return setError("Enter the join code shown by your lecturer.");
    if (!codeComplete) return setError("Join codes are 6 letters and numbers, e.g. K7M2QX.");
    if (!name.trim()) return setError("Enter your name so the lecturer knows you've joined.");
    setSubmitting(true);
    try {
      const { lectureId } = await studentApi.join(cleanCode, name.trim());
      router.push(`/lecture/${lectureId}`);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <div>
        <label htmlFor="code" className="block text-sm font-medium text-fg-2">
          Lecture code
        </label>
        <input
          id="code"
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC234"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={9}
          aria-describedby="code-help"
          className="mt-2 w-full rounded-xl border-0 bg-canvas/70 px-4 py-4 text-center font-mono text-3xl font-medium tracking-[0.3em] text-fg uppercase ring-1 ring-line-strong transition placeholder:text-faint focus:ring-2 focus:ring-ai focus:outline-none sm:text-4xl"
        />
        <div id="code-help" className="mt-2 min-h-5 text-sm" aria-live="polite">
          {codeComplete && !currentPreview && (
            <span className="flex items-center gap-2 text-muted">
              <Spinner className="size-3" /> Checking code…
            </span>
          )}
          {currentPreview?.lecture && (
            <span className="flex animate-fade-in flex-wrap items-center gap-2 text-fg-2">
              <span className="font-medium text-fg">{currentPreview.lecture.title}</span>
              <StatusBadge status={currentPreview.lecture.status} />
            </span>
          )}
          {currentPreview?.error && <span className="text-confused">{currentPreview.error}</span>}
          {!codeComplete && <span className="text-muted">The code is shown on the lecturer&apos;s screen.</span>}
        </div>
      </div>

      {joinedAs && currentPreview?.lecture ? (
        <div className="animate-fade-up space-y-3 rounded-xl bg-ai/[0.07] p-4 ring-1 ring-inset ring-ai/25">
          <p className="text-sm text-fg-2">
            This browser has already joined as <span className="font-medium text-fg">{joinedAs}</span>.
          </p>
          <Button className="w-full py-3 text-base" onClick={() => router.push(`/lecture/${currentPreview.lecture!.lectureId}`)}>
            Continue as {joinedAs}
          </Button>
          <p className="text-xs text-muted">
            To join as a different student, use a private window or another browser. Each browser keeps one student&apos;s notes and AI chat.
          </p>
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-fg-2">
              Your name
            </label>
            <input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sam Patel"
              autoComplete="name"
              maxLength={60}
              className="mt-2 w-full rounded-xl border-0 bg-canvas/70 px-4 py-3 text-base text-fg ring-1 ring-line-strong transition placeholder:text-faint focus:ring-2 focus:ring-ai focus:outline-none"
            />
            <p className="mt-2 text-xs text-muted">Your notes and Lecture AI chat are private to you on this browser.</p>
          </div>

          {error && <ErrorNotice message={error} />}

          <Button type="submit" disabled={submitting} className="w-full py-3 text-base">
            {submitting ? (
              <>
                <Spinner /> Joining…
              </>
            ) : (
              <>
                Join Lecture <span aria-hidden>→</span>
              </>
            )}
          </Button>
        </>
      )}
    </form>
  );
}

export default function JoinPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="ambient-glow animate-ambient opacity-80" />
      </div>
      <header className="relative z-10 mx-auto flex h-16 w-full max-w-6xl items-center px-5 sm:px-8">
        <Logo />
      </header>
      <main className="relative z-10 flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center sm:pt-0">
        <div className="w-full max-w-md animate-fade-up">
          <div className="rounded-3xl border border-line-strong bg-surface/85 p-6 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9),0_0_60px_-30px_rgb(124_92_255/0.5)] backdrop-blur-xl sm:p-8">
            <div className="mb-7 text-center">
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg sm:text-[1.75rem]">Join your lecture</h1>
              <p className="mt-2 text-sm text-muted">Enter the code on your lecturer&apos;s screen.</p>
            </div>
            <Suspense
              fallback={
                <div className="flex justify-center text-muted">
                  <Spinner />
                </div>
              }
            >
              <JoinForm />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
