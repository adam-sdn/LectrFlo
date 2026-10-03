import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { ConnectionStatus } from "@/lib/realtime-client";
import type { LectureStatus } from "@/lib/types";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-ai text-white shadow-[0_0_0_1px_rgb(155_135_255/0.4),0_8px_24px_-8px_rgb(124_92_255/0.7)] hover:bg-[#8a6dff] hover:shadow-[0_0_0_1px_rgb(155_135_255/0.55),0_10px_28px_-8px_rgb(124_92_255/0.85)] disabled:bg-ai/40 disabled:text-white/60 disabled:shadow-none",
  secondary: "bg-surface-2 text-fg ring-1 ring-inset ring-line-strong hover:bg-surface-3 disabled:text-faint",
  danger: "bg-confused/10 text-confused ring-1 ring-inset ring-confused/30 hover:bg-confused/20 disabled:opacity-50",
  ghost: "text-muted hover:bg-white/5 hover:text-fg disabled:text-faint",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ai-bright active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({
  title,
  action,
  className = "",
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-medium text-fg">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Small uppercase label above a heading or metric. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[11px] font-medium uppercase tracking-[0.16em] text-muted ${className}`}>{children}</p>;
}

/** Cyan dot with a gentle pulse: the one signal that means "this is happening now". */
export function LiveDot({ className = "" }: { className?: string }) {
  return <span className={`inline-block size-2 shrink-0 animate-live-pulse rounded-full bg-live ${className}`} aria-hidden />;
}

const STATUS_STYLES: Record<LectureStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-white/5 text-muted ring-line-strong" },
  lobby: { label: "Lobby open", className: "bg-ai/10 text-ai-bright ring-ai/30" },
  live: { label: "Live", className: "bg-live/10 text-live ring-live/30" },
  ended: { label: "Ended", className: "bg-white/5 text-muted ring-line-strong" },
};

export function StatusBadge({ status }: { status: LectureStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ring-1 ring-inset ${style.className}`}
    >
      {status === "live" && <LiveDot className="size-1.5" />}
      {status === "lobby" && <span className="size-1.5 rounded-full bg-ai-bright" aria-hidden />}
      {style.label}
    </span>
  );
}

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center gap-3 text-sm text-muted">
      <Spinner /> {label}
    </div>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 rounded-xl bg-confused/[0.08] px-3.5 py-2.5 text-sm text-[#fecdd3] ring-1 ring-inset ring-confused/25"
    >
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="shrink-0 font-medium text-confused underline underline-offset-2 hover:text-[#fda4af]">
          Try again
        </button>
      )}
    </div>
  );
}

/** The LectrFlow mark: a lectern-and-signal glyph on the brand gradient. */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center rounded-[9px] bg-linear-to-br from-ai to-live shadow-[0_0_20px_-4px_rgb(124_92_255/0.7)] ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-[62%] text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M5 18V6" />
        <path d="M9.5 18v-6" />
        <path d="M14 18V9" />
        <path d="M18.5 18v-3" />
      </svg>
    </span>
  );
}

export function Logo({ href = "/", className = "" }: { href?: string | null; className?: string }) {
  const content = (
    <>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight text-fg">LectrFlow</span>
    </>
  );
  return href ? (
    <Link href={href} className={`flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ai-bright ${className}`}>
      {content}
    </Link>
  ) : (
    <span className={`flex items-center gap-2.5 ${className}`}>{content}</span>
  );
}

/** Splits "Calculus 101 — Differentiation" into a course name and topic. */
export function splitTitle(title: string): { course: string; topic: string | null } {
  const match = title.match(/^(.+?)\s+[—–-]\s+(.+)$/);
  return match ? { course: match[1], topic: match[2] } : { course: title, topic: null };
}

export function AppHeader({
  role,
  title,
  children,
}: {
  role: "Lecturer" | "Student";
  /** Lecture context shown next to the logo (title, status). */
  title?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Logo className="shrink-0" />
        <span className="hidden rounded-md border border-line px-2 py-0.5 text-[11px] font-medium text-muted sm:inline">{role}</span>
        {title && (
          <>
            <span className="hidden h-5 w-px bg-line-strong md:block" aria-hidden />
            <div className="hidden min-w-0 items-center gap-3 md:flex">{title}</div>
          </>
        )}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-3 sm:gap-4">{children}</div>
      </div>
    </header>
  );
}

export function ConnectionDot({ status }: { status: ConnectionStatus }) {
  const label = status === "connected" ? "Realtime on" : status === "connecting" ? "Connecting…" : "Reconnecting…";
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted" title={label}>
      {status === "connected" ? (
        <LiveDot className="size-1.5" />
      ) : (
        <span className={`size-1.5 rounded-full ${status === "connecting" ? "bg-muted" : "bg-confused"}`} aria-hidden />
      )}
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}
