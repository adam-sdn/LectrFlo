import "server-only";
import { maybe, must } from "@/lib/api";
import {
  AI_MESSAGE_COLUMNS,
  ANNOTATION_COLUMNS,
  QUESTION_COLUMNS,
  toAiMessage,
  toAnnotation,
  toStudentQuestion,
  type AiMessageRow,
  type AnnotationRow,
  type QuestionRow,
} from "@/lib/db";
import { adminClient } from "@/lib/supabase/admin";
import type { AiMessage, Annotation, StudentNotes, StudentQuestion } from "@/lib/types";

export interface StudentActivityData {
  notes: StudentNotes;
  annotations: Annotation[];
  questions: StudentQuestion[];
  /** The whole Lecture AI conversation (questions and answers), oldest first. */
  aiMessages: AiMessage[];
  aiQuestions: string[];
  confusedSlides: number[];
}

/** Everything one student did in a lecture. Only ever loads that participant's rows. */
export async function loadStudentActivity(participantId: string): Promise<StudentActivityData> {
  const db = adminClient();
  const [notes, annotations, questions, aiMessages, confusion] = await Promise.all([
    db
      .from("student_notes")
      .select("content, updated_at")
      .eq("participant_id", participantId)
      .maybeSingle<{ content: string; updated_at: string }>()
      .then(maybe),
    db
      .from("slide_annotations")
      .select(ANNOTATION_COLUMNS)
      .eq("participant_id", participantId)
      .order("slide_number")
      .order("created_at")
      .returns<AnnotationRow[]>()
      .then(must),
    db
      .from("student_questions")
      .select(QUESTION_COLUMNS)
      .eq("participant_id", participantId)
      .order("created_at")
      .returns<QuestionRow[]>()
      .then(must),
    db
      .from("ai_messages")
      .select(AI_MESSAGE_COLUMNS)
      .eq("participant_id", participantId)
      .order("created_at")
      .returns<AiMessageRow[]>()
      .then(must),
    db
      .from("confusion_signals")
      .select("slide_number")
      .eq("participant_id", participantId)
      .returns<{ slide_number: number }[]>()
      .then(must),
  ]);
  return {
    notes: { content: notes?.content ?? "", updatedAt: notes?.updated_at ?? null },
    annotations: annotations.map(toAnnotation),
    questions: questions.map(toStudentQuestion),
    aiMessages: aiMessages.map(toAiMessage),
    aiQuestions: aiMessages.filter((m) => m.role === "student").map((m) => m.content),
    confusedSlides: [...new Set(confusion.map((c) => c.slide_number))].sort((a, b) => a - b),
  };
}
