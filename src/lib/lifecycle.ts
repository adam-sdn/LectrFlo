import type { LectureStatus } from "./types";

export type LifecycleAction = "open" | "start" | "end";

// open: draft -> lobby (join code live, students wait)
// start: draft|lobby -> live
// end: lobby|live -> ended
export const TRANSITIONS: Record<LifecycleAction, { from: LectureStatus[]; to: LectureStatus }> = {
  open: { from: ["draft"], to: "lobby" },
  start: { from: ["draft", "lobby"], to: "live" },
  end: { from: ["lobby", "live"], to: "ended" },
};

export function canTransition(status: LectureStatus, action: LifecycleAction): boolean {
  return TRANSITIONS[action].from.includes(status);
}

export const JOINABLE_STATUSES: LectureStatus[] = ["lobby", "live"];

export function isJoinable(status: LectureStatus): boolean {
  return JOINABLE_STATUSES.includes(status);
}

/** Slides students may see: none before start, up to the current slide while live, all once ended. */
export function revealedSlideLimit(status: LectureStatus, currentSlide: number, slideCount: number): number {
  if (status === "ended") return slideCount;
  if (status === "live") return Math.min(currentSlide, slideCount);
  return 0;
}
