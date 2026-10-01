// Shared password rules and generation.
//
// Why this file exists: the repo previously shipped a hard-coded admin password
// in both the seed script and the docs. Because this repository is public, that
// made the default admin credential public knowledge -- anyone reading the code
// could sign in as ADMIN on any deployment that kept it. Nothing in this file is
// a secret; it exists so the default is never predictable again. (The old value
// is deliberately not repeated here, so it can't be copy-pasted by mistake.)

import { randomInt } from "crypto";

export const MIN_PASSWORD_LENGTH = 8;

// Ambiguous characters (0/O, 1/l/I) are deliberately absent so a password
// copied by hand from a terminal, or read out over the phone, doesn't go wrong.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%^*_=+";

const REQUIRED_CLASSES = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/];

/** A strong, readable random password (~118 bits at the default length). */
export function generatePassword(length = 20): string {
  // Retry until the result contains an upper, a lower, a digit and a symbol, so
  // it satisfies any complexity rule a deployment might add later.
  for (let attempt = 0; attempt < 100; attempt++) {
    let out = "";
    for (let i = 0; i < length; i++) {
      out += ALPHABET[randomInt(ALPHABET.length)];
    }
    if (REQUIRED_CLASSES.every((re) => re.test(out))) return out;
  }
  throw new Error("Could not generate a password.");
}

/**
 * Returns a human-readable problem with a candidate password, or null if it's
 * acceptable. Used by every endpoint that sets a password, so the rule can't
 * drift between "create staff", "reset someone else's" and "change my own".
 */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string" || password.length === 0) {
    return "A new password is required.";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > 200) {
    return "That password is too long.";
  }
  return null;
}
