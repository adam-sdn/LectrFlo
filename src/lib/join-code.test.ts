import { describe, expect, it } from "vitest";
import { JOIN_CODE_ALPHABET, generateJoinCode, normalizeJoinCode } from "./join-code";

describe("join codes", () => {
  it("generates 6-character codes from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateJoinCode();
      expect(code).toHaveLength(6);
      for (const ch of code) expect(JOIN_CODE_ALPHABET).toContain(ch);
      expect(normalizeJoinCode(code)).toBe(code);
    }
  });

  it("matches the database check constraint alphabet", () => {
    // Mirrors '^[A-HJ-NP-Z2-9]{6}$' in the migration.
    expect(JOIN_CODE_ALPHABET).toMatch(/^[A-HJ-NP-Z2-9]+$/);
    expect(new Set(JOIN_CODE_ALPHABET).size).toBe(32);
  });

  it("normalizes case, spaces and dashes", () => {
    expect(normalizeJoinCode(" abc-234 ")).toBe("ABC234");
    expect(normalizeJoinCode("abc 234")).toBe("ABC234");
  });

  it("rejects malformed codes", () => {
    expect(normalizeJoinCode("")).toBeNull();
    expect(normalizeJoinCode("ABC23")).toBeNull();
    expect(normalizeJoinCode("ABC2345")).toBeNull();
    expect(normalizeJoinCode("ABCD10")).toBeNull(); // 1 and 0 are excluded
    expect(normalizeJoinCode("ABCDOI")).toBeNull(); // O and I are excluded
  });
});
