import Link from "next/link";
import { HeroPreview } from "@/components/landing/hero-preview";
import { Reveal } from "@/components/motion";
import { LiveDot, Logo } from "@/components/ui";

const primaryCta =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-ai px-5 py-3 text-sm font-medium text-white shadow-[0_0_0_1px_rgb(155_135_255/0.45),0_10px_30px_-10px_rgb(124_92_255/0.9)] transition duration-200 hover:-translate-y-px hover:bg-[#8a6dff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ai-bright";
const secondaryCta =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.04] px-5 py-3 text-sm font-medium text-fg ring-1 ring-inset ring-line-strong transition duration-200 hover:-translate-y-px hover:bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ai-bright";

export default function Home() {
  return (
    <div className="relative overflow-x-clip">
      {/* Nav */}
      <header className="relative z-20">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Logo />
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/join" className="rounded-lg px-3 py-2 text-sm text-muted transition hover:text-fg">
              Join a lecture
            </Link>
            <Link href="/lecturer" className="hidden rounded-lg bg-white/[0.06] px-3.5 py-2 text-sm font-medium text-fg ring-1 ring-inset ring-line-strong transition hover:bg-white/10 sm:inline-flex">
              Start a lecture
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-x-0 -top-16 h-[52rem] grid-fade" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[48rem] overflow-hidden" aria-hidden>
          <div className="ambient-glow animate-ambient" />
        </div>

        <div className="relative mx-auto max-w-6xl px-5 pt-14 pb-24 sm:px-8 sm:pt-20 lg:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-line-strong bg-white/[0.03] px-3 py-1 text-xs text-fg-2">
              <LiveDot className="size-1.5" />
              The AI-powered live classroom
            </p>
            <h1
              className="mt-6 animate-fade-up text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.035em] text-balance text-fg sm:text-6xl lg:text-7xl"
              style={{ animationDelay: "60ms" }}
            >
              The classroom that <span className="text-gradient">listens back.</span>
            </h1>
            <p
              className="mx-auto mt-6 max-w-xl animate-fade-up text-base leading-relaxed text-pretty text-muted sm:text-lg"
              style={{ animationDelay: "120ms" }}
            >
              LectrFlow turns live lectures into interactive, intelligent classrooms. Students follow along, ask a private Lecture AI
              and flag confusion in one tap — and lecturers see the room in real time.
            </p>
            <div className="mt-9 flex animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: "180ms" }}>
              <Link href="/lecturer" className={`${primaryCta} w-full sm:w-auto`}>
                Start a Lecture <span aria-hidden>→</span>
              </Link>
              <Link href="/join" className={`${secondaryCta} w-full sm:w-auto`}>
                Join a Lecture
              </Link>
            </div>
          </div>

          <div className="mt-16 animate-fade-up sm:mt-20" style={{ animationDelay: "260ms" }}>
            <HeroPreview />
          </div>
        </div>
      </section>

      {/* Three concepts */}
      <section className="relative border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
          <Reveal className="max-w-2xl">
            <p className="text-xs font-medium tracking-[0.16em] text-muted">HOW IT WORKS</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-balance text-fg sm:text-4xl">
              One lecture. Three layers of intelligence.
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            <Feature
              index="01"
              eyebrow="Live classroom"
              eyebrowTone="text-live"
              title="See what's happening in your classroom in real time."
              body="Students join with a code or QR in seconds and follow your slides on their own screen."
              delayMs={0}
            >
              <LiveVisual />
            </Feature>
            <Feature
              index="02"
              eyebrow="Lecture AI"
              eyebrowTone="text-ai-bright"
              title="Ask questions and get answers grounded in the lecture."
              body="Every student gets a private tutor that knows your slides and learning objectives."
              delayMs={80}
            >
              <AiVisual />
            </Feature>
            <Feature
              index="03"
              eyebrow="Classroom intelligence"
              eyebrowTone="text-confused"
              title="Turn confusion and questions into actionable insight."
              body="When the lecture ends, AI explains where the class struggled and what to change next time."
              delayMs={160}
            >
              <InsightVisual />
            </Feature>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative border-t border-line">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="ambient-glow opacity-60" />
        </div>
        <Reveal className="relative mx-auto max-w-3xl px-5 py-24 text-center sm:px-8">
          <h2 className="text-3xl font-semibold tracking-[-0.025em] text-balance text-fg sm:text-5xl">Your next lecture could listen back.</h2>
          <p className="mx-auto mt-4 max-w-md text-muted">Start a live lecture in under a minute. Students join from any phone.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/lecturer" className={`${primaryCta} w-full sm:w-auto`}>
              Start a Lecture <span aria-hidden>→</span>
            </Link>
            <Link href="/join" className={`${secondaryCta} w-full sm:w-auto`}>
              Join a Lecture
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-xs text-faint sm:flex-row sm:px-8">
          <Logo href={null} />
          <p>The classroom that listens back.</p>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  index,
  eyebrow,
  eyebrowTone,
  title,
  body,
  delayMs,
  children,
}: {
  index: string;
  eyebrow: string;
  eyebrowTone: string;
  title: string;
  body: string;
  delayMs: number;
  children: React.ReactNode;
}) {
  return (
    <Reveal delayMs={delayMs} className="group">
      <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition duration-300 hover:-translate-y-0.5 hover:border-line-strong">
        <div className="relative h-52 overflow-hidden border-b border-line bg-[radial-gradient(120%_100%_at_50%_0%,rgb(255_255_255/0.03),transparent)] p-5">
          {children}
        </div>
        <div className="flex flex-1 flex-col p-6">
          <p className={`flex items-center gap-2 text-xs font-medium tracking-[0.14em] uppercase ${eyebrowTone}`}>
            <span className="text-faint">{index}</span> {eyebrow}
          </p>
          <h3 className="mt-3 text-lg leading-snug font-medium tracking-tight text-fg">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
        </div>
      </article>
    </Reveal>
  );
}

function LiveVisual() {
  const people = ["SP", "AK", "JL", "MR", "TN", "EO"];
  return (
    <div className="flex h-full flex-col justify-between" aria-hidden>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 rounded-full bg-live/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-live ring-1 ring-inset ring-live/30">
          <LiveDot className="size-1.5" /> LIVE
        </span>
        <span className="font-mono text-xs tracking-[0.25em] text-fg-2">K7M2QX</span>
      </div>
      <div>
        <div className="flex -space-x-2">
          {people.map((p, i) => (
            <span
              key={p}
              className="flex size-9 items-center justify-center rounded-full border-2 border-surface bg-surface-3 text-[10px] font-medium text-fg-2 transition duration-300 group-hover:translate-y-[-2px]"
              style={{ transitionDelay: `${i * 30}ms` }}
            >
              {p}
            </span>
          ))}
          <span className="flex size-9 items-center justify-center rounded-full border-2 border-surface bg-live/15 text-[10px] font-medium text-live">+36</span>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-muted">
          <span>42 students following</span>
          <span>Slide 3 / 6</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full w-1/2 rounded-full bg-live/80" />
        </div>
      </div>
    </div>
  );
}

function AiVisual() {
  return (
    <div className="flex h-full flex-col justify-end gap-2.5" aria-hidden>
      <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-white/[0.06] px-3 py-2 text-xs text-fg-2">
        Why is the derivative of x² equal to 2x?
      </div>
      <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-ai/25 bg-ai/[0.08] px-3 py-2.5 text-xs leading-relaxed text-fg-2">
        <p className="mb-1 text-[10px] font-medium text-ai-bright">✦ Lecture AI</p>
        Using the limit definition from slide 3: [(x + h)² − x²] / h simplifies to 2x + h, which tends to 2x as h → 0.
      </div>
      <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-white/[0.04] px-2 py-1 text-[10px] text-muted ring-1 ring-inset ring-line">
        Grounded in slide 3 · The limit definition
      </span>
    </div>
  );
}

function InsightVisual() {
  const bars = [8, 14, 72, 30, 18, 10];
  return (
    <div className="flex h-full flex-col justify-between" aria-hidden>
      <div className="flex h-24 items-end gap-2">
        {bars.map((h, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <span
              className={`w-full rounded-md transition-colors duration-500 ${i === 2 ? "bg-confused/80 group-hover:bg-confused" : "bg-white/10"}`}
              style={{ height: `${Math.round(h * 0.8)}px` }}
            />
            <span className="text-[9px] text-faint">{i + 1}</span>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-ai/25 bg-ai/[0.07] px-3 py-2.5 text-xs leading-snug text-fg-2">
        <span className="text-ai-bright">✦</span> Slide 3 caused the most confusion. Revisit the limit definition with a worked example.
      </div>
    </div>
  );
}
