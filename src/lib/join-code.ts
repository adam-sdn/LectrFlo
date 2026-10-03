import { randomInt } from "node:crypto";

// No 0/O or 1/I to avoid misreads from a projector. Must match the DB check.
export const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_LENGTH = 6;
const JOIN_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

export function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

/** Uppercases and strips spaces/dashes. Returns null if not a valid code. */
export function normalizeJoinCode(input: string): string | null {
  const code = input.trim().toUpperCase().replace(/[\s-]/g, "");
  return JOIN_CODE_PATTERN.test(code) ? code : null;
}
