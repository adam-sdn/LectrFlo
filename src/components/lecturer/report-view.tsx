"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, ErrorNotice, Spinner } from "@/components/ui";
import { useInterval } from "@/lib/client/hooks";
import { ClientApiError, errorMessage } from "@/lib/client/http";
import { lecturerApi } from "@/lib/client/lecturer-api";
import type { LecturerReportResponse } from "@/lib/types";

/** Post-lecture stats plus the AI insight report, generated automatically on first view. */
export function ReportView({ lectureId }: { lectureId: string }) {
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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Students joined" value={data?.stats.participantCount} />
        <Stat label="Questions asked" value={data?.stats.questionCount} />
        <Stat
          label="Students confused (peak slide)"
          value={data ? Math.max(0, ...data.stats.confusion.map((c) => c.uniqueStudents)) : undefined}
        />
      </div>

      <Card
        title={<span className="flex items-center gap-2">✨ AI insight report</span>}
        action={
          content && (
            <Button variant="ghost" onClick={() => generate(true)} disabled={generating}>
              Regenerate
            </Button>
          )
        }
      >
        {(generating || (!data && !loadError) || (report?.status === "pending" && !stalled)) && (
          <div className="flex items-center gap-3 py-6 text-sm text-slate-600">
            <Spinner /> Analysing confusion signals and questions… this can take up to a minute.
          </div>
        )}
        {aiUnavailable && !generating && (
          <p className="text-sm text-slate-600">
            The AI report isn&apos;t available because no AI provider is configured on the server. The class statistics above are still accurate.
          </p>
        )}
        {loadError && <ErrorNotice message={`Couldn't load the report: ${loadError}`} onRetry={() => void load()} />}
        {!generating && generateError && <ErrorNotice message={generateError} onRetry={() => generate(false)} />}
        {!generating && !generateError && report?.status === "failed" && (
          <ErrorNotice message={report.error ?? "The report couldn't be generated."} onRetry={() => generate(false)} />
        )}
        {!generating && stalled && (
          <ErrorNotice message="Report generation didn't finish." onRetry={() => generate(false)} />
        )}
        {content && !generating && (
          <div className="space-y-6">
            <p className="text-base leading-relaxed text-slate-800">{content.summary}</p>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-700">Confusion hotspots</h3>
                {content.confusionHotspots.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No slides stood out.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {content.confusionHotspots.map((h, i) => (
                      <li key={i} className="rounded-xl bg-rose-50 p-3 ring-1 ring-rose-100">
                        <p className="text-sm font-semibold text-slate-900">Slide {h.slideNumber}: {h.likelyCause}</p>
                        <p className="mt-1 text-sm text-slate-700">{h.suggestion}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Question themes</h3>
                {content.questionThemes.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No questions were asked.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {content.questionThemes.map((t, i) => (
                      <li key={i} className="rounded-xl bg-indigo-50 p-3 ring-1 ring-indigo-100">
                        <p className="text-sm font-semibold text-slate-900">
                          {t.theme} <span className="font-normal text-slate-500">· {t.count}</span>
                        </p>
                        {t.exampleQuestions.slice(0, 2).map((q, j) => (
                          <p key={j} className="mt-1 text-sm italic text-slate-700">“{q}”</p>
                        ))}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {content.recommendations.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Recommendations for next time</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
                  {content.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>

      {data && data.stats.confusion.length > 0 && (
        <Card title="Confusion by slide">
          <ul className="space-y-2">
            {data.stats.confusion.map((c) => {
              const pct = data.stats.participantCount ? (c.uniqueStudents / data.stats.participantCount) * 100 : 0;
              return (
                <li key={c.slideNumber} className="flex items-center gap-3 text-sm">
                  <span className="w-16 shrink-0 text-slate-600">Slide {c.slideNumber}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span className="block h-full rounded-full bg-rose-400" style={{ width: `${Math.min(100, pct)}%` }} />
                  </span>
                  <span className="w-24 shrink-0 text-right tabular-nums text-slate-700">
                    {c.uniqueStudents} student{c.uniqueStudents === 1 ? "" : "s"}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value ?? "–"}</p>
    </div>
  );
}
