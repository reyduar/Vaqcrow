import type { BusinessPort } from "@/application/ports/business-port";

/**
 * Null-object `BusinessPort` for when no backend is configured: every call
 * answers a sanitized `unavailable` so the wizard reports the failure instead
 * of throwing, and never submits the request. Kept in its own module so
 * importing it never pulls in the browser auth/Supabase wiring.
 */
export const UNAVAILABLE_BUSINESS_PORT: BusinessPort = Object.freeze({
  createBusiness: async () => ({ ok: false as const, code: "unavailable" as const }),
  getMyBusiness: async () => ({ ok: false as const, code: "unavailable" as const })
});
