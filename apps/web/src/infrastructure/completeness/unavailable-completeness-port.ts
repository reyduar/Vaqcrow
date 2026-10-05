import type { CompletenessCheckPort } from "@/application/ports/completeness-check-port";

/**
 * Null-object `CompletenessCheckPort` for when no backend is configured: every
 * call answers a sanitized `unavailable` so the wizard reports the failure
 * instead of throwing, and the step stays non-blocking. Kept in its own module
 * so importing it never pulls in the browser auth/Supabase wiring.
 */
export const UNAVAILABLE_COMPLETENESS_PORT: CompletenessCheckPort = Object.freeze({
  check: async () => ({ ok: false as const, code: "unavailable" as const })
});
