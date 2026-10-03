import Image from "next/image";
import Link from "next/link";
import type { ComponentPropsWithRef, ReactNode } from "react";
import type { ConnectionStatus } from "@/lib/realtime-client";
import type { LectureStatus } from "@/lib/types";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-indigo-300",
  secondary: "bg-white text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:text-slate-400",
  danger: "bg-rose-600 text-white hover:bg-rose-500 disabled:bg-rose-300",
  ghost: "text-slate-600 hover:bg-slate-100 disabled:text-slate-300",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentPropsWithRef<"button"> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
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
    <section className={`border border-slate-200 bg-white p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const STATUS_STYLES: Record<LectureStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700" },
  lobby: { label: "Lobby open", className: "bg-amber-100 text-amber-800" },
  live: { label: "Live", className: "bg-emerald-100 text-emerald-800" },
  ended: { label: "Ended", className: "bg-slate-200 text-slate-700" },
};

export function StatusBadge({ status }: { status: LectureStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-none px-2 py-0.5 text-[11px] font-semibold tracking-wider uppercase ${style.className}`}>
      {status === "live" && <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />}
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
    <div className="flex min-h-[60vh] items-center justify-center gap-3 text-slate-500">
      <Spinner /> {label}
    </div>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start justify-between gap-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-2">
          Try again
        </button>
      )}
    </div>
  );
}

export function AppHeader({ role, children }: { role: "Lecturer" | "Student"; children?: ReactNode }) {
  return (
    <header className="border-b border-slate-300 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-slate-900">
          <Image src="/brand/lectrflo-mark.png" alt="" width={30} height={30} priority />
          <span className="font-display text-xl font-bold tracking-tight">LectrFlo</span>
        </Link>
        <span className="border-l border-slate-200 pl-3 text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase">{role}</span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">{children}</div>
      </div>
    </header>
  );
}

export function ConnectionDot({ status }: { status: ConnectionStatus }) {
  const label = status === "connected" ? "Live updates on" : status === "connecting" ? "Connecting…" : "Reconnecting…";
  const color = status === "connected" ? "bg-emerald-500" : status === "connecting" ? "bg-amber-400" : "bg-rose-500";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500" title={label}>
      <span className={`size-2 rounded-full ${color}`} aria-hidden />
      {label}
    </span>
  );
}
