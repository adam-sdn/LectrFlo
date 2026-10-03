// Shared domain and API response types. Field names are camelCase; route
// handlers map database rows (snake_case) into these shapes.

export type LectureStatus = "draft" | "lobby" | "live" | "ended";
export type QuestionStatus = "open" | "answered" | "dismissed";
export type AiJobStatus = "pending" | "complete" | "failed";
export type ObjectiveSource = "lecturer" | "ai";

export interface LearningObjective {
  id: string;
  position: number;
  text: string;
  source: ObjectiveSource;
}

export interface Slide {
  slideNumber: number;
  /** Short-lived signed URL; refetch lecture state when it expires. */
  imageUrl: string | null;
  hasText: boolean;
}

export interface LectureSummary {
  id: string;
  title: string;
  module: string | null;
  description: string | null;
  lecturerName: string | null;
  status: LectureStatus;
  currentSlide: number;
  slideCount: number;
  startedAt: string | null;
  endedAt: string | null;
}

// Lecturer --------------------------------------------------------------------

export interface LecturerLecture extends LectureSummary {
  joinCode: string;
  /** Realtime channel for lecturer-only events. Keep private. */
  hostChannel: string;
  createdAt: string;
}

export interface LecturerLectureDetail extends LecturerLecture {
  slides: Slide[];
  objectives: LearningObjective[];
  participantCount: number;
  participants: { displayName: string; joinedAt: string }[];
}

export interface LecturerQuestion {
  id: string;
  body: string;
  slideNumber: number | null;
  status: QuestionStatus;
  createdAt: string;
  answeredAt: string | null;
}

export interface ConfusionSlideStat {
  slideNumber: number;
  signalCount: number;
  uniqueStudents: number;
}

export interface ConfusionSummary {
  windowSeconds: number;
  currentSlide: number;
  /** Distinct students who signalled on the current slide within the window. */
  recentUniqueStudents: number;
  participantCount: number;
  bySlide: ConfusionSlideStat[];
}

export interface LecturerInsightContent {
  summary: string;
  confusionHotspots: { slideNumber: number; likelyCause: string; suggestion: string }[];
  questionThemes: { theme: string; count: number; exampleQuestions: string[] }[];
  recommendations: string[];
}

export interface AiReport<T> {
  status: AiJobStatus;
  content: T | null;
  error: string | null;
  updatedAt: string;
}

export interface LecturerReportResponse {
  report: AiReport<LecturerInsightContent> | null;
  stats: {
    participantCount: number;
    questionCount: number;
    confusion: ConfusionSlideStat[];
  };
}

// Student ---------------------------------------------------------------------

export interface JoinPreview {
  lectureId: string;
  title: string;
  module: string | null;
  lecturerName: string | null;
  status: LectureStatus;
}

export interface JoinResponse {
  lectureId: string;
  participant: { id: string; displayName: string };
}

export interface StudentLectureState {
  lecture: LectureSummary;
  /** Slides revealed so far (all slides after the lecture ends). */
  slides: Slide[];
  objectives: LearningObjective[];
  participant: { id: string; displayName: string };
  realtime: { channel: string };
}

export interface StudentNotes {
  content: string;
  updatedAt: string | null;
}

export interface Annotation {
  id: string;
  slideNumber: number;
  content: string;
  x: number | null;
  y: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentQuestion {
  id: string;
  body: string;
  slideNumber: number | null;
  status: QuestionStatus;
  createdAt: string;
}

export interface ConfusionResponse {
  slideNumber: number;
  createdAt: string;
  cooldownSeconds: number;
}

export interface AiMessage {
  id: string;
  role: "student" | "assistant";
  content: string;
  slideNumber: number | null;
  status: AiJobStatus;
  createdAt: string;
}

export interface StudentRecapContent {
  summary: string;
  keyConcepts: { concept: string; explanation: string }[];
  objectivesReview: { objective: string; takeaway: string }[];
  struggledWith: { topic: string; slideNumber: number | null; suggestion: string }[];
  followUp: string[];
}

export interface StudentRecapResponse {
  lecture: LectureSummary;
  objectives: LearningObjective[];
  report: AiReport<StudentRecapContent> | null;
  notes: StudentNotes;
  annotations: Annotation[];
  questions: StudentQuestion[];
  confusedSlides: number[];
}

// Errors ----------------------------------------------------------------------

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
