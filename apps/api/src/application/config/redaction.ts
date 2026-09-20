import { REDACTED_MARKER, isSecret } from "./secret.js";

/**
 * Log redaction boundary.
 *
 * Two independent nets, because either one alone leaks:
 *
 *   1. Structure — a `Secret`, or any value stored under a key that reads as
 *      sensitive, collapses to a marker.
 *   2. Content — free text is scanned for token-shaped values, so a credential
 *      interpolated into a message or a stack trace is still caught.
 *
 * Identifiers the demo needs for traceability (`correlationId`,
 * `applicationId`, transaction hashes) are deliberately left intact: a
 * redaction layer that hides everything is as useless as one that hides
 * nothing.
 */

const SENSITIVE_KEY_PATTERN =
  /secret|token|password|passphrase|authorization|credential|apikey|publishablekey|privatekey|servicerolekey|mnemonic|seed|cookie/;

/** JWT shape — Supabase service-role and publishable keys are JWTs. */
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g;

/** Stellar secret seed: `S` followed by 55 base32 characters. */
const STELLAR_SEED_PATTERN = /\bS[A-Z2-7]{55}\b/g;

/** Long opaque runs (base64/hex credentials) that are not dashed identifiers. */
const OPAQUE_TOKEN_PATTERN = /\b[A-Za-z0-9+/]{40,}={0,2}\b/g;

const MAX_DEPTH = 8;

/** Masks token-shaped values inside free text. */
export function redactText(text: string): string {
  return text
    .replace(JWT_PATTERN, REDACTED_MARKER)
    .replace(STELLAR_SEED_PATTERN, REDACTED_MARKER)
    .replace(OPAQUE_TOKEN_PATTERN, REDACTED_MARKER);
}

/** True when a property name reads as sensitive, ignoring case and separators. */
export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_KEY_PATTERN.test(normalized);
}

/**
 * Returns a structurally safe copy for logging. Depth is capped so a cyclic or
 * pathologically nested value degrades to a marker instead of hanging.
 */
export function redactForLog(value: unknown, depth = 0): unknown {
  if (isSecret(value)) {
    return REDACTED_MARKER;
  }

  if (typeof value === "string") {
    return redactText(value);
  }

  if (depth >= MAX_DEPTH) {
    return "[truncated]";
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactForLog(entry, depth + 1));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return { name: value.name, message: redactText(value.message) };
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    redacted[key] = isSensitiveKey(key) ? REDACTED_MARKER : redactForLog(entry, depth + 1);
  }

  return redacted;
}
