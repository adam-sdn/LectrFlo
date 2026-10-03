"use client";

import { useState } from "react";
import type { Slide } from "@/lib/types";

/** Shows one slide image at 16:9, with placeholders for missing or unrevealed slides. */
export function SlideViewer({
  slide,
  slideNumber,
  slideCount,
  placeholder,
  onImageError,
}: {
  slide: Slide | undefined;
  slideNumber: number;
  slideCount: number;
  placeholder?: string;
  /** Called when the image fails (e.g. an expired signed URL) so the page can refetch. */
  onImageError?: (url: string) => void;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = slide?.imageUrl ?? null;
  const showImage = url && failedUrl !== url;

  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-[#0b1020] shadow-[0_30px_80px_-40px_rgb(0_0_0/0.9)]">
      <div className="relative aspect-video w-full">
        {showImage ? (
          // Signed Supabase Storage URLs; next/image optimisation adds nothing for these.
          // Keyed by slide so each change fades in rather than snapping.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={slideNumber}
            src={url}
            alt={`Lecture slide ${slideNumber}`}
            className="absolute inset-0 size-full animate-fade-in object-contain"
            onError={() => {
              setFailedUrl(url);
              onImageError?.(url);
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted">
            {failedUrl === url && url
              ? "This slide couldn't be loaded."
              : (placeholder ?? (slideCount === 0 ? "No slides uploaded yet" : "Slide unavailable"))}
          </div>
        )}
      </div>
      {slideCount > 0 && (
        <figcaption className="flex items-center justify-between gap-3 border-t border-line bg-surface px-4 py-2.5 text-xs text-muted">
          <span className="tabular-nums">
            Slide <span className="text-fg-2">{slideNumber}</span> of {slideCount}
          </span>
          <span className="flex items-center gap-1" aria-hidden>
            {Array.from({ length: Math.min(slideCount, 24) }, (_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${i + 1 === slideNumber ? "w-4 bg-live" : i + 1 < slideNumber ? "w-1.5 bg-white/30" : "w-1.5 bg-white/10"}`}
              />
            ))}
          </span>
        </figcaption>
      )}
    </figure>
  );
}
