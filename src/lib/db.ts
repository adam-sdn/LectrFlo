import "server-only";
import type {
  AiJobStatus,
  AiMessage,
  AiReport,
  Annotation,
  LearningObjective,
  LectureStatus,
  LectureSummary,
  LecturerLecture,
  LecturerQuestion,
  ObjectiveSource,
  QuestionStatus,
  StudentQuestion,
} from "@/lib/types";
import { hostChannel } from "@/lib/realtime";

export interface LectureRow {
  id: string;
  lecturer_id: string;
  lecturer_name: string | null;
  title: string;
  module: string | null;
  description: string | null;
  join_code: string;
  host_channel_key: string;
  status: LectureStatus;
  current_slide: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SlideRow {
  id: string;
  lecture_id: string;
  slide_number: number;
  storage_path: string;
  mime_type: string;
  text_content: string | null;
}

export interface ParticipantRow {
  id: string;
  lecture_id: string;
  display_name: string;
  joined_at: string;
}

export function toLectureSummary(row: LectureRow, slideCount: number): LectureSummary {
  return {
    id: row.id,
    title: row.title,
    module: row.module,
    description: row.description,
    lecturerName: row.lecturer_name,
    status: row.status,
    currentSlide: row.current_slide,
    slideCount,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

export function toLecturerLecture(row: LectureRow, slideCount: number): LecturerLecture {
  return {
    ...toLectureSummary(row, slideCount),
    joinCode: row.join_code,
    hostChannel: hostChannel(row.host_channel_key),
    createdAt: row.created_at,
  };
}

export function toObjective(row: { id: string; position: number; text: string; source: ObjectiveSource }): LearningObjective {
  return { id: row.id, position: row.position, text: row.text, source: row.source };
}

export interface QuestionRow {
  id: string;
  body: string;
  slide_number: number | null;
  status: QuestionStatus;
  created_at: string;
  answered_at: string | null;
}

export function toLecturerQuestion(row: QuestionRow): LecturerQuestion {
  return {
    id: row.id,
    body: row.body,
    slideNumber: row.slide_number,
    status: row.status,
    createdAt: row.created_at,
    answeredAt: row.answered_at,
  };
}

export function toStudentQuestion(row: QuestionRow): StudentQuestion {
  return {
    id: row.id,
    body: row.body,
    slideNumber: row.slide_number,
    status: row.status,
    createdAt: row.created_at,
  };
}

export interface AnnotationRow {
  id: string;
  slide_number: number;
  content: string;
  x: number | null;
  y: number | null;
  created_at: string;
  updated_at: string;
}

export function toAnnotation(row: AnnotationRow): Annotation {
  return {
    id: row.id,
    slideNumber: row.slide_number,
    content: row.content,
    x: row.x,
    y: row.y,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface AiMessageRow {
  id: string;
  role: "student" | "assistant";
  content: string;
  slide_number: number | null;
  status: AiJobStatus;
  created_at: string;
}

export function toAiMessage(row: AiMessageRow): AiMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    slideNumber: row.slide_number,
    status: row.status,
    createdAt: row.created_at,
  };
}

export interface AiReportRow {
  status: AiJobStatus;
  content: unknown;
  error: string | null;
  updated_at: string;
}

export function toAiReport<T>(row: AiReportRow | null): AiReport<T> | null {
  if (!row) return null;
  return {
    status: row.status,
    content: (row.content as T | null) ?? null,
    error: row.error,
    updatedAt: row.updated_at,
  };
}

export const LECTURE_COLUMNS =
  "id, lecturer_id, lecturer_name, title, module, description, join_code, host_channel_key, status, current_slide, started_at, ended_at, created_at, updated_at";
export const QUESTION_COLUMNS = "id, body, slide_number, status, created_at, answered_at";
export const ANNOTATION_COLUMNS = "id, slide_number, content, x, y, created_at, updated_at";
export const AI_MESSAGE_COLUMNS = "id, role, content, slide_number, status, created_at";
export const AI_REPORT_COLUMNS = "status, content, error, updated_at";
