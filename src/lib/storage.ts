import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { SIGNED_URL_SECONDS } from "@/lib/limits";
import type { Slide } from "@/lib/types";
import type { SlideRow } from "@/lib/db";

export const SLIDES_BUCKET = "lecture-slides";

export async function uploadSlideImage(path: string, file: File): Promise<void> {
  const { error } = await adminClient()
    .storage.from(SLIDES_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Slide upload failed: ${error.message}`);
}

export async function removeSlideImages(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await adminClient().storage.from(SLIDES_BUCKET).remove(paths);
  if (error) console.error("Failed to remove slide images", error);
}

export async function downloadSlideImage(path: string): Promise<{ data: string; mimeType: string } | null> {
  const { data, error } = await adminClient().storage.from(SLIDES_BUCKET).download(path);
  if (error || !data) return null;
  return { data: Buffer.from(await data.arrayBuffer()).toString("base64"), mimeType: data.type };
}

/** Maps slide rows to API slides with signed image URLs. */
export async function signSlides(rows: SlideRow[]): Promise<Slide[]> {
  if (rows.length === 0) return [];
  const { data, error } = await adminClient()
    .storage.from(SLIDES_BUCKET)
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      SIGNED_URL_SECONDS,
    );
  if (error) console.error("Failed to sign slide URLs", error);
  const urlByPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return rows.map((r) => ({
    slideNumber: r.slide_number,
    imageUrl: urlByPath.get(r.storage_path) ?? null,
    hasText: Boolean(r.text_content),
  }));
}
