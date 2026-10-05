/**
 * The in-app notification capability of the role-aware header (Feature #382,
 * Task #383 / T1d). Vendor-free and React-free: the HTTP adapter lives in
 * `infrastructure/notifications/`.
 *
 * A notification belongs to one recipient, and the API is the single
 * enforcement point: it resolves the recipient from the verified token, so the
 * browser never sends one. `list()` therefore returns only the signed-in
 * principal's own rows and `markRead(id)` can only ever touch those.
 *
 * The copy (`title`, `body`, `ctaLabel`, `ctaHref`) is rendered by the API's
 * catalogue and travels verbatim — this boundary never invents or re-derives a
 * message. Every failure is a sanitized code, never a provider message.
 */

/** One stored notification, exactly as `GET /notifications` returns it. */
export interface NotificationItem {
  readonly id: string;
  readonly recipientUserId: string;
  readonly eventKey: string;
  readonly eventType: string;
  readonly title: string;
  readonly body: string;
  readonly ctaLabel: string | null;
  readonly ctaHref: string | null;
  /** ISO timestamp, or `null` while unread. */
  readonly readAt: string | null;
  readonly createdAt: string;
}

/**
 * Sanitized failure codes. They mirror the API's `{ code }` / `{ error }`
 * envelopes plus the transport's own `network`; the UI maps each one to copy.
 */
export type NotificationErrorCode = "unavailable" | "network" | "not_found";

export const NOTIFICATION_ERROR_CODES: readonly NotificationErrorCode[] = Object.freeze([
  "unavailable",
  "network",
  "not_found"
]);

export type NotificationListResult =
  | { readonly ok: true; readonly notifications: readonly NotificationItem[] }
  | { readonly ok: false; readonly code: NotificationErrorCode };

export type NotificationCountResult =
  | { readonly ok: true; readonly unread: number }
  | { readonly ok: false; readonly code: NotificationErrorCode };

export type NotificationMarkReadResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: NotificationErrorCode };

export type NotificationMarkAllResult =
  | { readonly ok: true; readonly updated: number }
  | { readonly ok: false; readonly code: NotificationErrorCode };

export interface NotificationPort {
  /** The signed-in principal's notifications, newest first. */
  list(): Promise<NotificationListResult>;
  /** The unread badge count. */
  countUnread(): Promise<NotificationCountResult>;
  /** Marks one notification read; an unknown or foreign id is `not_found`. */
  markRead(id: string): Promise<NotificationMarkReadResult>;
  /** Marks every unread notification read; resolves with how many changed. */
  markAllRead(): Promise<NotificationMarkAllResult>;
}
