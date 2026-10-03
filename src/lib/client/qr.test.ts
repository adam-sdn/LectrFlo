import { describe, expect, it } from "vitest";
import { encodeQr } from "./qr";

describe("encodeQr", () => {
  it("picks the smallest version that fits", () => {
    expect(encodeQr("A").size).toBe(21);
    expect(encodeQr("https://lectrflow.app/join?code=K7M2QX").size).toBe(29); // 38 bytes fits version 3-M
  });

  it("draws the three finder patterns", () => {
    const { size, modules } = encodeQr("https://lectrflow.app/join?code=K7M2QX");
    for (const [x, y] of [
      [0, 0],
      [size - 7, 0],
      [0, size - 7],
    ]) {
      expect(modules[y][x]).toBe(true);
      expect(modules[y + 1][x + 1]).toBe(false);
      expect(modules[y + 3][x + 3]).toBe(true);
    }
  });

  it("rejects text beyond version 10", () => {
    expect(() => encodeQr("x".repeat(300))).toThrow();
  });
});
