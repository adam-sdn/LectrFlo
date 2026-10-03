import type { Slide } from "@/lib/types";

// Signed URLs are valid for an hour; reuse one for 45 minutes so refetches don't
// change the <img> src (which would re-download and flash the slide).
const MAX_AGE_MS = 45 * 60 * 1000;
const MAX_RETRIES_PER_IMAGE = 2;

const objectPath = (url: string) => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

export function createSlideUrlCache() {
  const cache = new Map<string, { url: string; at: number }>();
  const failures = new Map<string, number>();

  return {
    /** Returns the slides with previously issued, still-fresh URLs for the same stored image. */
    stabilize(slides: Slide[]): Slide[] {
      const now = Date.now();
      return slides.map((slide) => {
        if (!slide.imageUrl) return slide;
        const key = objectPath(slide.imageUrl);
        const hit = cache.get(key);
        if (hit && now - hit.at < MAX_AGE_MS) return { ...slide, imageUrl: hit.url };
        cache.set(key, { url: slide.imageUrl, at: now });
        return slide;
      });
    },
    /** Forgets a URL that failed to load. Returns false once an image has failed repeatedly. */
    invalidate(url: string): boolean {
      const key = objectPath(url);
      cache.delete(key);
      const count = (failures.get(key) ?? 0) + 1;
      failures.set(key, count);
      return count <= MAX_RETRIES_PER_IMAGE;
    },
  };
}
