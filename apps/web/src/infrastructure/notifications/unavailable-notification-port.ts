import type { NotificationPort } from "@/application/ports/notification-port";

/**
 * Null-object `NotificationPort` for when no backend is configured (#480):
 * every call answers `not_configured` — the honest "no API wired up", which the
 * bell renders as a calm unavailable notice, **not** as a service failure and
 * never as an invented empty inbox. Kept in its own module so importing it never
 * pulls in the browser auth/Supabase wiring.
 */
export const UNAVAILABLE_NOTIFICATION_PORT: NotificationPort = Object.freeze({
  list: async () => ({ ok: false as const, code: "not_configured" as const }),
  countUnread: async () => ({ ok: false as const, code: "not_configured" as const }),
  markRead: async () => ({ ok: false as const, code: "not_configured" as const }),
  markAllRead: async () => ({ ok: false as const, code: "not_configured" as const })
});
