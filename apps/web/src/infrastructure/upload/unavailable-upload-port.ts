import type { UploadPort } from "@/application/ports/upload-port";

/**
 * Null-object `UploadPort` for when no backend is configured: every call
 * answers a sanitized `unavailable` so the UI still renders and reports the
 * failure instead of throwing. Kept in its own module so importing it never
 * pulls in the browser auth/Supabase wiring.
 */
export const UNAVAILABLE_UPLOAD_PORT: UploadPort = Object.freeze({
  uploadDocument: async () => ({ ok: false as const, code: "unavailable" as const }),
  removeDocument: async () => ({ ok: false as const, code: "unavailable" as const })
});
