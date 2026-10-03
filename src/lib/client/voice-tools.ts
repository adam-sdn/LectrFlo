import { ClientApiError } from "./http";

export interface VoiceToolDeps {
  getSlideSummary: () => Promise<string>;
  markConfused: () => Promise<{ slideNumber: number }>;
  askLecturer: (question: string) => Promise<void>;
  saveNote: (text: string) => Promise<void> | void;
  /** Called with a short human-readable record of each action, for the on-screen activity log. */
  onActivity: (entry: string) => void;
}

const asText = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const reason = (err: unknown) =>
  err instanceof ClientApiError || err instanceof Error ? err.message : "something went wrong";

/**
 * Client tools for the ElevenLabs voice agent. Names must match the tools configured on the agent.
 * Each returns a short sentence the agent can relay; failures are reported in words, never thrown.
 */
export function createVoiceTools(deps: VoiceToolDeps) {
  return {
    get_current_slide: async () => {
      try {
        return await deps.getSlideSummary();
      } catch (err) {
        return `Could not get the current slide: ${reason(err)}`;
      }
    },
    mark_confused: async () => {
      try {
        const { slideNumber } = await deps.markConfused();
        deps.onActivity(`Sent an anonymous "I'm confused" for slide ${slideNumber}`);
        return `Registered an anonymous confusion signal for slide ${slideNumber}. The lecturer only sees a count.`;
      } catch (err) {
        if (err instanceof ClientApiError && err.code === "cooldown") {
          return "The student already sent a confusion signal moments ago, so it is still counted.";
        }
        return `Could not send the confusion signal: ${reason(err)}`;
      }
    },
    ask_lecturer: async (params: Record<string, unknown>) => {
      const question = asText(params.question).slice(0, 1000);
      if (!question) return "No question was provided, so nothing was sent.";
      try {
        await deps.askLecturer(question);
        deps.onActivity(`Asked the lecturer: "${question}"`);
        return "The question was sent anonymously to the lecturer.";
      } catch (err) {
        return `Could not send the question: ${reason(err)}`;
      }
    },
    save_note: async (params: Record<string, unknown>) => {
      const text = asText(params.text).slice(0, 2000);
      if (!text) return "No note text was provided, so nothing was saved.";
      try {
        await deps.saveNote(text);
        deps.onActivity(`Saved to your notes: "${text}"`);
        return "Saved to the student's private notes.";
      } catch (err) {
        return `Could not save the note: ${reason(err)}`;
      }
    },
  };
}
