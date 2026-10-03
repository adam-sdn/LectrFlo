import { describe, expect, it } from "vitest";
import { aggregateConfusion } from "./confusion";
import { cooldownRemaining, windowStart } from "./limits";

describe("cooldownRemaining", () => {
  const now = new Date("2026-01-01T12:00:30Z");

  it("allows the first action", () => {
    expect(cooldownRemaining(null, 30, now)).toBe(0);
  });

  it("reports whole seconds remaining", () => {
    expect(cooldownRemaining(new Date("2026-01-01T12:00:20Z"), 30, now)).toBe(20);
    expect(cooldownRemaining(new Date("2026-01-01T12:00:29.5Z"), 30, now)).toBe(30);
  });

  it("allows the action once the cooldown has passed", () => {
    expect(cooldownRemaining(new Date("2026-01-01T12:00:00Z"), 30, now)).toBe(0);
  });
});

describe("windowStart", () => {
  it("subtracts the window", () => {
    expect(windowStart(120, new Date("2026-01-01T12:02:00Z"))).toBe("2026-01-01T12:00:00.000Z");
  });
});

describe("aggregateConfusion", () => {
  it("counts signals and distinct students per slide, sorted by slide", () => {
    const stats = aggregateConfusion([
      { slide_number: 3, participant_id: "a" },
      { slide_number: 1, participant_id: "a" },
      { slide_number: 3, participant_id: "a" },
      { slide_number: 3, participant_id: "b" },
    ]);
    expect(stats).toEqual([
      { slideNumber: 1, signalCount: 1, uniqueStudents: 1 },
      { slideNumber: 3, signalCount: 3, uniqueStudents: 2 },
    ]);
  });

  it("handles no signals", () => {
    expect(aggregateConfusion([])).toEqual([]);
  });
});
