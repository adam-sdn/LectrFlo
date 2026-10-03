import { LiveDot, LogoMark } from "@/components/ui";

/**
 * Illustrative product mockup for the landing hero (static marketing visual, not live data).
 * Mirrors the real lecturer console: slide on the left, live classroom signals on the right.
 */
export function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      {/* Floating signals around the preview: very slow, small drift. */}
      <FloatingChip className="-top-5 left-2 sm:-left-6 lg:-left-14" delay="0s">
        <LiveDot />
        <span className="font-medium text-fg">42 students live</span>
      </FloatingChip>
      <FloatingChip className="-top-5 right-24 hidden sm:flex lg:right-28" delay="-3s" slow>
        <span className="size-2 rounded-full bg-confused" aria-hidden />
        <span className="font-medium text-fg">7 students confused</span>
        <span className="text-muted">· slide 3</span>
      </FloatingChip>
      <FloatingChip className="-bottom-6 left-6 hidden sm:flex lg:-left-10" delay="-5s">
        <span className="text-ai-bright">✦</span>
        <span className="font-medium text-fg">Lecture AI</span>
        <span className="text-muted">answered 18 questions</span>
      </FloatingChip>

      <div className="relative overflow-hidden rounded-2xl border border-line-strong bg-surface/90 shadow-[0_40px_120px_-30px_rgb(124_92_255/0.35),0_0_0_1px_rgb(255_255_255/0.02)]">
        {/* Window chrome */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <div className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-white/10" />
            <span className="size-2.5 rounded-full bg-white/10" />
            <span className="size-2.5 rounded-full bg-white/10" />
          </div>
          <div className="flex min-w-0 items-center gap-2.5">
            <LogoMark className="size-5" />
            <span className="truncate text-xs text-fg-2">
              Calculus 101 <span className="text-faint">·</span> <span className="text-muted">Differentiation</span>
            </span>
          </div>
          <span className="ml-auto inline-flex items-center gap-2 rounded-full bg-live/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-live ring-1 ring-inset ring-live/30">
            <LiveDot className="size-1.5" /> LIVE
          </span>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-[1fr_15rem]">
          {/* Slide */}
          <div className="relative overflow-hidden rounded-xl border border-line bg-[#0b1020]">
            <div className="aspect-video p-[6%]">
              <p className="text-[9px] font-semibold tracking-[0.18em] text-ai-bright sm:text-[11px]">MATH 101 · DIFFERENTIATION</p>
              <p className="mt-2 text-lg font-semibold tracking-tight text-fg sm:text-2xl lg:text-3xl">The limit definition</p>
              <div className="mt-[4%] rounded-lg border border-line-strong bg-white/[0.03] px-[4%] py-[3%] font-serif text-sm text-fg-2 sm:text-lg lg:text-xl">
                f′(x) = lim<sub className="text-[0.6em]">h→0</sub> [ f(x + h) − f(x) ] / h
              </div>
              <ul className="mt-[4%] hidden space-y-1.5 text-muted sm:block sm:text-sm">
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-ai" aria-hidden /> Slope of the secant between x and x + h
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-ai" aria-hidden /> Let h shrink towards 0
                </li>
              </ul>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-line bg-black/20 px-3 py-1.5 text-[10px] text-faint">
              <span>Slide 3 of 6</span>
              <span className="flex gap-1" aria-hidden>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <span key={n} className={`h-1 rounded-full ${n === 3 ? "w-4 bg-live" : n < 3 ? "w-1.5 bg-white/30" : "w-1.5 bg-white/10"}`} />
                ))}
              </span>
            </div>
          </div>

          {/* Live classroom panel */}
          <div className="hidden flex-col gap-3 md:flex">
            <p className="text-[10px] font-medium tracking-[0.16em] text-muted">LIVE CLASSROOM</p>
            <div className="grid grid-cols-3 gap-2">
              <MiniStat value="42" label="Students" tone="text-fg" />
              <MiniStat value="7" label="Confused" tone="text-confused" ring />
              <MiniStat value="3" label="Questions" tone="text-fg" />
            </div>
            <div className="rounded-xl border border-line bg-surface-2 p-3">
              <div className="flex items-center justify-between text-[10px] text-muted">
                <span>Confusion · slide 3</span>
                <span className="text-confused">17%</span>
              </div>
              <div className="mt-2 flex h-10 items-end gap-1" aria-hidden>
                {[10, 18, 14, 32, 58, 100, 74, 46].map((h, i) => (
                  <span key={i} className={`flex-1 rounded-sm ${i >= 4 && i <= 6 ? "bg-confused/80" : "bg-white/10"}`} style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-line bg-surface-2 p-3">
              <p className="text-[10px] text-muted">Anonymous question</p>
              <p className="mt-1 text-xs leading-snug text-fg-2">Why does h have to go to zero and not just be small?</p>
            </div>
            <div className="rounded-xl border border-ai/25 bg-ai/[0.07] p-3">
              <p className="text-[10px] font-medium text-ai-bright">✦ Lecture AI</p>
              <p className="mt-1 text-xs leading-snug text-fg-2">Students are asking about limits — consider a worked example.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ value, label, tone, ring = false }: { value: string; label: string; tone: string; ring?: boolean }) {
  return (
    <div className={`rounded-xl border bg-surface-2 px-2 py-2.5 text-center ${ring ? "border-confused/30" : "border-line"}`}>
      <p className={`text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-0.5 text-[9px] text-muted">{label}</p>
    </div>
  );
}

function FloatingChip({
  children,
  className,
  delay,
  slow = false,
}: {
  children: React.ReactNode;
  className: string;
  delay: string;
  slow?: boolean;
}) {
  return (
    <div
      className={`absolute z-10 flex items-center gap-2 rounded-xl border border-line-strong bg-surface-2/90 px-3 py-2 text-xs shadow-[0_12px_40px_-12px_rgb(0_0_0/0.8)] backdrop-blur-md ${slow ? "animate-float-slow" : "animate-float"} ${className}`}
      style={{ animationDelay: delay }}
      aria-hidden
    >
      {children}
    </div>
  );
}
