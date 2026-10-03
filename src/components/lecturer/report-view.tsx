"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatedNumber } from "@/components/motion";
import { Button, ErrorNotice, Eyebrow, splitTitle } from "@/components/ui";
import { useInterval } from "@/lib/client/hooks";
import { ClientApiError, errorMessage } from "@/lib/client/http";
import { lecturerApi } from "@/lib/client/lecturer-api";
import type { LecturerInsightContent, LecturerReportResponse } from "@/lib/types";

/** Post-lecture stats plus the AI insight report, generated automatically on first view. */
export function ReportView({
  lectureId,
  title,
  module,
  slideCount = 0,
}: {
  lectureId: string;
  title?: string;
  module?: string | null;
  slideCount?: number;
}) {
  const [data, setData] = useState<LecturerReportResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [stalled, setStalled] = useState(false);
  const autoStarted = useRef(false);

  // regenerate=true only replaces a finished report; failed or stalled ones are retried with false.
  const generate = useCallback(
    async (regenerate: boolean) => {
      setGenerating(true);
      setGenerateError(null);
      setStalled(false);
      try {
        setData(await lecturerApi.generateReport(lectureId, regenerate));
      } catch (err) {
        if (err instanceof ClientApiError && err.code === "ai_unavailable") setAiUnavailable(true);
        else setGenerateError(errorMessage(err));
      } finally {
        setGenerating(false);
      }
    },
    [lectureId],
  );

  const load = useCallback(async () => {
    try {
      const result = await lecturerApi.getReport(lectureId);
      setData(result);
      setLoadError(null);
      const report = result.report;
      // The server takes over a pending report after 2 minutes; offer a retry instead of spinning forever.
      setStalled(report?.status === "pending" && Date.now() - Date.parse(report.updatedAt) > 150_000);
      if (!report && !autoStarted.current) {
        autoStarted.current = true;
        await generate(false);
      }
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, [lectureId, generate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Another tab may be generating; poll until it settles.
  useInterval(() => void load(), 3000, data?.report?.status === "pending" && !generating && !stalled);

  const report = data?.report;
  const content = report?.status === "complete" ? report.content : null;
  const analysing = generating || (!data && !loadError) || (report?.status === "pending" && !stalled);

  const stats = data?.stats;
  const participants = stats?.participantCount ?? 0;
  const peak = stats?.confusion.length
    ? stats.confusion.reduce((best, c) => (c.uniqueStudents > best.uniqueStudents ? c : best))
    : undefined;
  const peakConfused = peak?.uniqueStudents ?? 0;
  const totalSignals = stats?.confusion.reduce((sum, c) => sum + c.signalCount, 0) ?? 0;
  // Share of the class that didn't flag confusion even on the hardest slide.
  const understanding = participants > 0 ? Math.round(Math.max(0, 1 - peakConfused / participants) * 100) : null;
  const { course, topic } = splitTitle(title ?? "");

  return (
    <div className="animate-fade-up space-y-6">
      {/* Title */}
      <header className="relative overflow-hidden rounded-3xl border border-line bg-surface px-6 py-8 sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="ambient-glow opacity-70" />
        </div>
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <Eyebrow className="flex items-center gap-2 text-ai-bright">
              <span aria-hidden>✦</span> Lecture insights
            </Eyebrow>
            {title && (
              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-fg sm:text-5xl">
                {course}
                {topic && <span className="block text-muted">{topic}</span>}
              </h1>
            )}
            <p className="mt-4 text-sm text-muted">
              {module ? `${module} · ` : ""}Generated from live confusion signals and anonymous questions.
            </p>
          </div>
          {content && (
            <Button variant="secondary" onClick={() => generate(true)} disabled={generating}>
              ↻ Regenerate
            </Button>
          )}
        </div>

        {/* Metrics */}
        <div className="relative mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
          <Metric
            featured
            label="Class understanding"
            hint={peak ? `Not confused on slide ${peak.slideNumber}, the hardest` : "No confusion signals"}
            value={understanding}
            suffix="%"
          />
          <Metric label="Students" hint="joined the lecture" value={stats ? participants : null} />
          <Metric label="Confused" hint={peak ? `at peak · slide ${peak.slideNumber}` : "at peak"} value={stats ? peakConfused : null} tone="text-confused" />
          <Metric label="Questions" hint="asked anonymously" value={stats ? stats.questionCount : null} />
          <Metric label="Confusion signals" hint="across the lecture" value={stats ? totalSignals : null} />
        </div>
      </header>

      {/* AI interpretation */}
      <section className="relative overflow-hidden rounded-3xl border border-ai/25 bg-surface p-6 shadow-[0_0_80px_-40px_rgb(124_92_255/0.6)] sm:p-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-ai-bright/60 to-transparent" aria-hidden />

        {analysing && <Analysing questionCount={stats?.questionCount} signals={stats ? totalSignals : undefined} />}

        {aiUnavailable && !generating && (
          <p className="text-sm text-muted">
            The AI report isn&apos;t available because no AI provider is configured on the server. The class statistics above are still accurate.
          </p>
        )}
        {loadError && <ErrorNotice message={`Couldn't load the report: ${loadError}`} onRetry={() => void load()} />}
        {!generating && generateError && <ErrorNotice message={generateError} onRetry={() => generate(false)} />}
        {!generating && !generateError && report?.status === "failed" && (
          <ErrorNotice message={report.error ?? "The report couldn't be generated."} onRetry={() => generate(false)} />
        )}
        {!generating && stalled && <ErrorNotice message="Report generation didn't finish." onRetry={() => generate(false)} />}

        {content && !generating && <Insights content={content} />}
      </section>

      {stats && stats.confusion.length > 0 && (
        <ConfusionBySlide confusion={stats.confusion} participants={participants} slideCount={slideCount} />
      )}
    </div>
  );
}

function Metric({
  label,
  hint,
  value,
  suffix,
  tone = "text-fg",
  featured = false,
}: {
  label: string;
  hint: string;
  value: number | null;
  suffix?: string;
  tone?: string;
  featured?: boolean;
}) {
  return (
    <div className={`bg-surface p-5 sm:p-6 ${featured ? "col-span-2 sm:col-span-1" : ""}`}>
      <p className={`text-4xl font-semibold tracking-[-0.03em] sm:text-5xl ${featured ? "text-gradient" : tone}`}>
        {value === null ? <span className="text-faint">–</span> : <AnimatedNumber value={value} suffix={suffix} durationMs={1000} />}
      </p>
      <p className="mt-2 text-sm font-medium text-fg-2">{label}</p>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </div>
  );
}

function Analysing({ questionCount, signals }: { questionCount?: number; signals?: number }) {
  return (
    <div className="py-2" role="status">
      <p className="flex items-center gap-3 text-sm text-fg-2">
        <span className="relative flex size-6 items-center justify-center rounded-full bg-ai/15 text-ai-bright" aria-hidden>
          <span className="absolute inset-0 animate-ping rounded-full bg-ai/20" />✦
        </span>
        {questionCount !== undefined && signals !== undefined
          ? `Reading ${questionCount} question${questionCount === 1 ? "" : "s"} and ${signals} confusion signal${signals === 1 ? "" : "s"}…`
          : "Analysing the lecture…"}
      </p>
      <div className="mt-6 space-y-3" aria-hidden>
        {["w-11/12", "w-4/5", "w-2/3"].map((w, i) => (
          <div
            key={w}
            className={`h-3 rounded-full ${w} animate-shimmer bg-[linear-gradient(90deg,rgb(255_255_255/0.04)_0%,rgb(155_135_255/0.18)_50%,rgb(255_255_255/0.04)_100%)] bg-[length:200%_100%]`}
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
      <p className="mt-6 text-xs text-muted">Turning the live lecture into insight — this can take up to a minute.</p>
    </div>
  );
}

function InsightBlock({ icon, title, tone, children, delayMs }: { icon: string; title: string; tone: string; children: ReactNode; delayMs: number }) {
  return (
    <div className="animate-fade-up" style={{ animationDelay: `${delayMs}ms` }}>
      <h2 className={`flex items-center gap-2.5 text-sm font-medium ${tone}`}>
        <span className="flex size-6 items-center justify-center rounded-lg bg-current/10 text-xs" aria-hidden>
          {icon}
        </span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Insights({ content }: { content: LecturerInsightContent }) {
  const [lead, ...more] = content.recommendations;
  return (
    <div className="space-y-10">
      <InsightBlock icon="✦" title="What the class understood" tone="text-ai-bright" delayMs={0}>
        <p className="max-w-3xl text-lg leading-relaxed text-pretty text-fg sm:text-xl">{content.summary}</p>
      </InsightBlock>

      <div className="h-px bg-line" aria-hidden />

      <InsightBlock icon="⚠" title="Where students struggled" tone="text-confused" delayMs={90}>
        {content.confusionHotspots.length === 0 && content.questionThemes.length === 0 ? (
          <p className="text-sm text-muted">No slide stood out — the class followed along.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {content.confusionHotspots.length > 0 && (
              <ul className="space-y-3">
                {content.confusionHotspots.map((h, i) => (
                  <li key={i} className="rounded-2xl border border-confused/20 bg-confused/[0.05] p-4">
                    <p className="text-xs font-medium text-confused">Slide {h.slideNumber}</p>
                    <p className="mt-1 text-sm leading-relaxed text-fg">{h.likelyCause}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{h.suggestion}</p>
                  </li>
                ))}
              </ul>
            )}
            {content.questionThemes.length > 0 && (
              <div>
                <p className="mb-3 text-xs text-muted">What students asked about</p>
                <ul className="space-y-3">
                  {content.questionThemes.map((t, i) => (
                    <li key={i} className="rounded-2xl border border-line bg-surface-2 p-4">
                      <p className="flex items-baseline justify-between gap-3 text-sm font-medium text-fg">
                        {t.theme}
                        <span className="shrink-0 text-xs font-normal tabular-nums text-muted">
                          {t.count} question{t.count === 1 ? "" : "s"}
                        </span>
                      </p>
                      {t.exampleQuestions.slice(0, 2).map((q, j) => (
                        <p key={j} className="mt-1.5 text-sm text-muted">
                          “{q}”
                        </p>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </InsightBlock>

      {lead && (
        <>
          <div className="h-px bg-line" aria-hidden />
          <InsightBlock icon="→" title="AI recommendation" tone="text-success" delayMs={180}>
            <div className="rounded-2xl border border-ai/25 bg-linear-to-br from-ai/[0.1] to-live/[0.04] p-5 sm:p-6">
              <p className="text-base leading-relaxed text-fg sm:text-lg">{lead}</p>
            </div>
            {more.length > 0 && (
              <ul className="mt-4 space-y-2">
                {more.map((r, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed text-fg-2">
                    <span className="mt-0.5 text-success" aria-hidden>
                      →
                    </span>
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </InsightBlock>
        </>
      )}
    </div>
  );
}

function ConfusionBySlide({
  confusion,
  participants,
  slideCount,
}: {
  confusion: LecturerReportResponse["stats"]["confusion"];
  participants: number;
  slideCount: number;
}) {
  const count = Math.max(slideCount, ...confusion.map((c) => c.slideNumber));
  const rows = Array.from({ length: count }, (_, i) => confusion.find((c) => c.slideNumber === i + 1) ?? { slideNumber: i + 1, uniqueStudents: 0, signalCount: 0 });
  const peak = Math.max(1, ...rows.map((r) => r.uniqueStudents));
  return (
    <section className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-fg">Confusion by slide</h2>
        <span className="text-xs text-muted">Distinct students who signalled</span>
      </div>
      <div className="mt-6 flex h-40 items-end gap-2 sm:gap-3">
        {rows.map((r, i) => {
          const pct = participants ? Math.round((r.uniqueStudents / participants) * 100) : 0;
          return (
            <div key={r.slideNumber} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <span className="text-[11px] tabular-nums text-muted">{r.uniqueStudents > 0 ? r.uniqueStudents : ""}</span>
              <div
                className={`w-full max-w-14 origin-bottom animate-fade-up rounded-lg ${r.uniqueStudents === peak && r.uniqueStudents > 0 ? "bg-confused" : r.uniqueStudents > 0 ? "bg-confused/45" : "bg-white/[0.06]"}`}
                style={{ height: `${Math.max(4, (r.uniqueStudents / peak) * 100)}%`, animationDelay: `${i * 40}ms` }}
                title={`Slide ${r.slideNumber}: ${r.uniqueStudents} student${r.uniqueStudents === 1 ? "" : "s"} (${pct}%)`}
              />
              <span className="text-[11px] text-faint">{r.slideNumber}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
