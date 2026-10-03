// Realtime contract. Server code publishes via Supabase Broadcast; clients subscribe
// with `subscribeToChannel` from "@/lib/realtime-client". Events are hints that state
// changed: payloads carry the new values, and clients should refetch on reconnect.

import type { LectureStatus, LecturerQuestion } from "@/lib/types";

/** Public channel for everyone in a lecture. */
export const lectureChannel = (lectureId: string) => `lecture:${lectureId}`;
/** Lecturer-only channel; the key is only returned to the owning lecturer. */
export const hostChannel = (hostChannelKey: string) => `lecture-host:${hostChannelKey}`;

export interface LectureChannelEvents {
  lecture_state: {
    status: LectureStatus;
    currentSlide: number;
    slideCount: number;
    startedAt: string | null;
    endedAt: string | null;
  };
  slides_updated: { slideCount: number };
  objectives_updated: Record<string, never>;
}

export interface HostChannelEvents {
  participant_joined: { displayName: string; joinedAt: string; participantCount: number };
  confusion: {
    slideNumber: number;
    recentUniqueStudents: number;
    windowSeconds: number;
    participantCount: number;
    at: string;
  };
  question_created: { question: LecturerQuestion };
}
