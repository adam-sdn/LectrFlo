import type {
  AiMessage,
  ConfusionResponse,
  JoinPreview,
  JoinResponse,
  StudentLectureState,
  StudentNotes,
  StudentQuestion,
} from "@/lib/types";
import { apiRequest } from "./http";

// Students are identified by the httpOnly participant cookie set by POST /api/join.
export const studentApi = {
  preview: (code: string) => apiRequest<{ lecture: JoinPreview }>(`/api/join/${encodeURIComponent(code)}`),
  join: (code: string, displayName: string) =>
    apiRequest<JoinResponse>("/api/join", { method: "POST", body: { code, displayName } }),
  state: (id: string) => apiRequest<StudentLectureState>(`/api/student/lectures/${id}`),
  notes: (id: string) => apiRequest<{ notes: StudentNotes }>(`/api/student/lectures/${id}/notes`),
  saveNotes: (id: string, content: string) =>
    apiRequest<{ notes: StudentNotes }>(`/api/student/lectures/${id}/notes`, { method: "PUT", body: { content } }),
  confused: (id: string) => apiRequest<ConfusionResponse>(`/api/student/lectures/${id}/confusion`, { method: "POST" }),
  questions: (id: string) => apiRequest<{ questions: StudentQuestion[] }>(`/api/student/lectures/${id}/questions`),
  ask: (id: string, body: string) =>
    apiRequest<{ question: StudentQuestion }>(`/api/student/lectures/${id}/questions`, { method: "POST", body: { body } }),
  aiHistory: (id: string) => apiRequest<{ messages: AiMessage[] }>(`/api/student/lectures/${id}/ai`),
  askAi: (id: string, message: string) =>
    apiRequest<{ messages: AiMessage[] }>(`/api/student/lectures/${id}/ai`, { method: "POST", body: { message } }),
  exportUrl: (id: string) =>
    `/api/student/lectures/${id}/export?tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`,
  voiceSession: (id: string) =>
    apiRequest<{ signedUrl: string; dynamicVariables: Record<string, string> }>(`/api/student/lectures/${id}/voice`, {
      method: "POST",
    }),
  voiceSlide: (id: string) =>
    apiRequest<{ slideNumber: number | null; slideCount: number; summary: string }>(`/api/student/lectures/${id}/voice`),
};
