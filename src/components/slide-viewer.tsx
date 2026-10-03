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
    <figure className="overflow-hidden rounded-2xl bg-slate-900 shadow-sm ring-1 ring-slate-200">
      <div className="relative aspect-video w-full">
        {showImage ? (
          // Signed Supabase Storage URLs; next/image optimisation adds nothing for these.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={`Lecture slide ${slideNumber}`}
            className="absolute inset-0 size-full object-contain"
            onError={() => {
              setFailedUrl(url);
              onImageError?.(url);
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-slate-300">
            {failedUrl === url && url
              ? "This slide couldn't be loaded."
              : (placeholder ?? (slideCount === 0 ? "No slides uploaded yet" : "Slide unavailable"))}
          </div>
        )}
      </div>
      {slideCount > 0 && (
        <figcaption className="flex items-center justify-between bg-white px-4 py-2 text-xs font-medium text-slate-500">
          <span>Lecture slide</span>
          <span>
            Slide {slideNumber} of {slideCount}
          </span>
        </figcaption>
      )}
    </figure>
  );
}
