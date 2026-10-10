import type { AdminQueuePort, AdminQueueResult } from "@/application/ports/admin-queue-port";

/**
 * Null-object admin queue used when no backend base URL is configured: every
 * read is the sanitized `unavailable`, so the queue shows its error state
 * instead of an invented empty list.
 */
export const UNAVAILABLE_ADMIN_QUEUE_PORT: AdminQueuePort = Object.freeze({
  async list(): Promise<AdminQueueResult> {
    return { ok: false, code: "unavailable" };
  }
});
