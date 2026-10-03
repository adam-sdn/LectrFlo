import { describe, expect, it, vi } from "vitest";
import { ClientApiError } from "./http";
import { createVoiceTools } from "./voice-tools";

function setup(overrides: Partial<Parameters<typeof createVoiceTools>[0]> = {}) {
  const activity: string[] = [];
  const deps = {
    getSlideSummary: vi.fn(async () => "The lecture is on slide 3 of 6."),
    markConfused: vi.fn(async () => ({ slideNumber: 3 })),
    askLecturer: vi.fn(async () => undefined),
    saveNote: vi.fn(async () => undefined),
    onActivity: (entry: string) => activity.push(entry),
    ...overrides,
  };
  return { tools: createVoiceTools(deps), deps, activity };
}

describe("voice agent client tools", () => {
  it("relays the current slide", async () => {
    const { tools } = setup();
    expect(await tools.get_current_slide()).toBe("The lecture is on slide 3 of 6.");
  });

  it("marks confusion and logs it", async () => {
    const { tools, activity } = setup();
    expect(await tools.mark_confused()).toContain("slide 3");
    expect(activity).toEqual(['Sent an anonymous "I\'m confused" for slide 3']);
  });

  it("treats the cooldown as already counted", async () => {
    const { tools, activity } = setup({
      markConfused: vi.fn(async () => {
        throw new ClientApiError(429, "cooldown", "You can signal again in 20s");
      }),
    });
    expect(await tools.mark_confused()).toContain("already sent");
    expect(activity).toEqual([]);
  });

  it("sends trimmed questions and rejects empty ones", async () => {
    const { tools, deps, activity } = setup();
    expect(await tools.ask_lecturer({ question: "  Why divide by h?  " })).toContain("sent");
    expect(deps.askLecturer).toHaveBeenCalledWith("Why divide by h?");
    expect(activity).toHaveLength(1);
    expect(await tools.ask_lecturer({ question: "" })).toContain("No question");
    expect(await tools.ask_lecturer({})).toContain("No question");
    expect(deps.askLecturer).toHaveBeenCalledTimes(1);
  });

  it("reports API errors in words instead of throwing", async () => {
    const { tools } = setup({
      askLecturer: vi.fn(async () => {
        throw new ClientApiError(409, "lecture_not_live", "Cannot ask the lecturer a question while the lecture is lobby");
      }),
    });
    expect(await tools.ask_lecturer({ question: "Hi" })).toBe(
      "Could not send the question: Cannot ask the lecturer a question while the lecture is lobby",
    );
  });

  it("saves notes", async () => {
    const { tools, deps } = setup();
    expect(await tools.save_note({ text: "Power rule: n x^(n-1)" })).toContain("Saved");
    expect(deps.saveNote).toHaveBeenCalledWith("Power rule: n x^(n-1)");
    expect(await tools.save_note({ text: 42 })).toContain("No note");
  });
});
