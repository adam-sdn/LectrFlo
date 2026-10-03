export const CONFUSION_COOLDOWN_SECONDS = 30;
export const CONFUSION_WINDOW_SECONDS = 120;

export const QUESTION_LIMIT = { max: 5, windowSeconds: 60 };
export const AI_MESSAGE_LIMIT = { max: 10, windowSeconds: 300 };

export const MAX_SLIDES = 150;
export const MAX_SLIDE_BYTES = 10 * 1024 * 1024;
export const SLIDE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const SIGNED_URL_SECONDS = 60 * 60;
export const PARTICIPANT_COOKIE_MAX_AGE = 60 * 60 * 24;

/** Seconds left before another action is allowed, or 0 if allowed now. */
export function cooldownRemaining(lastAt: Date | null, cooldownSeconds: number, now = new Date()): number {
  if (!lastAt) return 0;
  const elapsed = (now.getTime() - lastAt.getTime()) / 1000;
  return elapsed >= cooldownSeconds ? 0 : Math.ceil(cooldownSeconds - elapsed);
}

export function windowStart(windowSeconds: number, now = new Date()): string {
  return new Date(now.getTime() - windowSeconds * 1000).toISOString();
}
