import { describe, expect, it } from "vitest";
import { canTransition, isJoinable, revealedSlideLimit } from "./lifecycle";

describe("lecture lifecycle", () => {
  it("allows the MVP transitions", () => {
    expect(canTransition("draft", "open")).toBe(true);
    expect(canTransition("lobby", "start")).toBe(true);
    expect(canTransition("draft", "start")).toBe(true);
    expect(canTransition("live", "end")).toBe(true);
    expect(canTransition("lobby", "end")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransition("live", "open")).toBe(false);
    expect(canTransition("live", "start")).toBe(false);
    expect(canTransition("ended", "start")).toBe(false);
    expect(canTransition("ended", "open")).toBe(false);
    expect(canTransition("draft", "end")).toBe(false);
  });

  it("only lets students join open lectures", () => {
    expect(isJoinable("draft")).toBe(false);
    expect(isJoinable("lobby")).toBe(true);
    expect(isJoinable("live")).toBe(true);
    expect(isJoinable("ended")).toBe(false);
  });

  it("reveals slides progressively", () => {
    expect(revealedSlideLimit("lobby", 1, 10)).toBe(0);
    expect(revealedSlideLimit("live", 4, 10)).toBe(4);
    expect(revealedSlideLimit("live", 12, 10)).toBe(10);
    expect(revealedSlideLimit("ended", 3, 10)).toBe(10);
  });
});
