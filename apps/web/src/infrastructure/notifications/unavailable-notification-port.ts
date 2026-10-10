import type { NotificationPort } from "@/application/ports/notification-port";

/**
 * Null-object `NotificationPort` for when no backend is configured: every call
 * answers a sanitized `unavailable` so the bell renders empty and never reaches
 * the network. Kept in its own module so importing it never pulls in the
 * browser auth/Supabase wiring.
 */
export const UNAVAILABLE_NOTIFICATION_PORT: NotificationPort = Object.freeze({
  list: async () => ({ ok: false as const, code: "unavailable" as const }),
  countUnread: async () => ({ ok: false as const, code: "unavailable" as const }),
  markRead: async () => ({ ok: false as const, code: "unavailable" as const }),
  markAllRead: async () => ({ ok: false as const, code: "unavailable" as const })
});
