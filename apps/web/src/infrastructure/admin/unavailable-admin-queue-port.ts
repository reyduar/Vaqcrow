import type { AdminQueuePort, AdminQueueResult } from "@/application/ports/admin-queue-port";

/**
 * Null-object admin queue used when no backend base URL is configured (#480):
 * every read answers `not_configured` — the honest "no API wired up", which the
 * queue renders as a calm notice, **not** as a service failure and never as an
 * invented empty list.
 */
export const UNAVAILABLE_ADMIN_QUEUE_PORT: AdminQueuePort = Object.freeze({
  async list(): Promise<AdminQueueResult> {
    return { ok: false, code: "not_configured" };
  }
});
