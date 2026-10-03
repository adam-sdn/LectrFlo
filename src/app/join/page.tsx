"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { AppHeader, Button, ErrorNotice, Spinner, StatusBadge } from "@/components/ui";
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
    <form onSubmit={submit} noValidate className="space-y-5 rounded-2xl bg-white p-6 ring-1 ring-slate-200 sm:p-8">
      <div>
        <label htmlFor="code" className="block text-sm font-semibold text-slate-900">
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
          className="mt-2 w-full rounded-xl border-0 px-4 py-3 text-center font-mono text-3xl font-bold tracking-[0.3em] uppercase ring-1 ring-slate-300 placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
        />
        <div id="code-help" className="mt-2 min-h-5 text-sm" aria-live="polite">
          {codeComplete && !currentPreview && (
            <span className="flex items-center gap-2 text-slate-500">
              <Spinner className="size-3" /> Checking code…
            </span>
          )}
          {currentPreview?.lecture && (
            <span className="flex flex-wrap items-center gap-2 text-slate-700">
              <span className="font-semibold">{currentPreview.lecture.title}</span>
              <StatusBadge status={currentPreview.lecture.status} />
            </span>
          )}
          {currentPreview?.error && <span className="text-rose-700">{currentPreview.error}</span>}
          {!codeComplete && <span className="text-slate-500">The code is shown on the lecturer&apos;s screen.</span>}
        </div>
      </div>

      {joinedAs && currentPreview?.lecture ? (
        <div className="space-y-3 rounded-xl bg-indigo-50 p-4 ring-1 ring-indigo-100">
          <p className="text-sm text-slate-800">
            This browser has already joined as <span className="font-semibold">{joinedAs}</span>.
          </p>
          <Button className="w-full py-3 text-base" onClick={() => router.push(`/lecture/${currentPreview.lecture!.lectureId}`)}>
            Continue as {joinedAs}
          </Button>
          <p className="text-xs text-slate-600">
            To join as a different student, use a private window or another browser. Each browser keeps one student&apos;s notes and AI chat.
          </p>
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-slate-900">
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
              className="mt-2 w-full rounded-xl border-0 px-4 py-3 text-base ring-1 ring-slate-300 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            />
            <p className="mt-2 text-xs text-slate-500">Your notes and Lecture AI chat are private to you on this browser.</p>
          </div>

          {error && <ErrorNotice message={error} />}

          <Button type="submit" disabled={submitting} className="w-full py-3 text-base">
            {submitting ? (
              <>
                <Spinner /> Joining…
              </>
            ) : (
              "Join lecture"
            )}
          </Button>
        </>
      )}
    </form>
  );
}

export default function JoinPage() {
  return (
    <>
      <AppHeader role="Student" />
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="mb-6 text-center text-2xl font-bold tracking-tight">Join a lecture</h1>
        <Suspense fallback={<div className="flex justify-center"><Spinner /></div>}>
          <JoinForm />
        </Suspense>
      </main>
    </>
  );
}
