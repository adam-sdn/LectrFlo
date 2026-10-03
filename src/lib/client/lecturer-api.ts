"use client";

import { browserClient } from "@/lib/supabase/browser";
import type {
  ConfusionSummary,
  LearningObjective,
  LecturerLecture,
  LecturerLectureDetail,
  LecturerQuestion,
  LecturerReportResponse,
  Slide,
} from "@/lib/types";
import { ClientApiError, apiRequest } from "./http";

const DEMO_LECTURER_NAME = "Demo Lecturer";

/**
 * Returns an access token for the lecturer. The MVP has no sign-in screen, so a
 * Supabase anonymous session is created on first use; each browser owns the
 * lectures it creates and the API still enforces ownership.
 */
async function lecturerToken(): Promise<string> {
  const auth = browserClient().auth;
  const { data } = await auth.getSession();
  if (data.session) return data.session.access_token;

  const { data: created, error } = await auth.signInAnonymously({
    options: { data: { full_name: DEMO_LECTURER_NAME } },
  });
  if (error || !created.session) {
    throw new ClientApiError(
      401,
      "lecturer_session_failed",
      `Couldn't start a lecturer session${error ? `: ${error.message}` : ""}. Make sure anonymous sign-ins are enabled in Supabase.`,
    );
  }
  return created.session.access_token;
}

async function call<T>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}) {
  return apiRequest<T>(path, { ...opts, token: await lecturerToken() });
}

export const lecturerApi = {
  listLectures: () => call<{ lectures: LecturerLecture[] }>("/api/lectures"),
  createLecture: (input: { title: string; module?: string; description?: string }) =>
    call<{ lecture: LecturerLecture }>("/api/lectures", { method: "POST", body: input }),
  getLecture: (id: string) => call<{ lecture: LecturerLectureDetail }>(`/api/lectures/${id}`),
  lifecycle: (id: string, action: "open" | "start" | "end") =>
    call<{ lecture: LecturerLecture }>(`/api/lectures/${id}/lifecycle`, { method: "POST", body: { action } }),
  setSlide: (id: string, slideNumber: number) =>
    call<{ lecture: LecturerLecture }>(`/api/lectures/${id}/current-slide`, { method: "PUT", body: { slideNumber } }),
  uploadSlides: (id: string, files: Blob[]) => {
    const form = new FormData();
    files.forEach((file, i) => form.append("files", file, `slide-${i + 1}.png`));
    return call<{ slides: Slide[] }>(`/api/lectures/${id}/slides`, { method: "POST", form });
  },
  setSlideText: (id: string, slideNumber: number, textContent: string) =>
    call<unknown>(`/api/lectures/${id}/slides/${slideNumber}`, { method: "PATCH", body: { textContent } }),
  setObjectives: (id: string, objectives: string[]) =>
    call<{ objectives: LearningObjective[] }>(`/api/lectures/${id}/objectives`, { method: "PUT", body: { objectives } }),
  confusion: (id: string) => call<ConfusionSummary>(`/api/lectures/${id}/confusion`),
  questions: (id: string) => call<{ questions: LecturerQuestion[] }>(`/api/lectures/${id}/questions`),
  getReport: (id: string) => call<LecturerReportResponse>(`/api/lectures/${id}/report`),
  generateReport: (id: string, regenerate = false) =>
    call<LecturerReportResponse>(`/api/lectures/${id}/report`, { method: "POST", body: { regenerate } }),
};
