import type { Role } from "./auth-port.js";

/**
 * Vendor-free notification persistence port (Feature #382, Task #383 / T1b-1).
 *
 * The catalogue decides *what* to say; this port decides where it is stored.
 * The Supabase implementation is `SupabaseNotificationRepository` (T1b-2) and
 * reads/writes `public.notification` as `service_role`; nothing provider-shaped
 * crosses this boundary.
 *
 * `eventType` is carried as a plain string, mirroring the `text` column: the
 * catalogue can grow without a database migration, so the persistence port does
 * not narrow to the current union. The application layer validates the key.
 */

export interface NotificationRecipient {
  readonly userId: string;
  readonly email: string;
}

/** A notification to enqueue. `id`, `createdAt` and `readAt` are the store's. */
export interface NewNotification {
  readonly recipientUserId: string;
  readonly eventKey: string;
  readonly eventType: string;
  readonly title: string;
  readonly body: string;
  readonly ctaLabel: string | null;
  readonly ctaHref: string | null;
}

/**
 * The directory read's outcome. A provider failure is `unavailable`, distinct
 * from a role that genuinely has no active recipients (`ok` with an empty
 * list), so a caller can tell "nobody to notify" from "the lookup broke".
 */
export type ResolveRecipientsResult =
  | { readonly ok: true; readonly recipients: readonly NotificationRecipient[] }
  | { readonly ok: false; readonly code: "unavailable" };

/**
 * The enqueue outcome. A provider failure is `unavailable`; the success branch
 * reports whether the row was inserted or already existed on the idempotency
 * key, with the row's id either way.
 */
export type InsertIfAbsentResult =
  | { readonly ok: true; readonly inserted: boolean; readonly id: string }
  | { readonly ok: false; readonly code: "unavailable" };

export interface StoredNotification {
  readonly id: string;
  readonly recipientUserId: string;
  readonly eventKey: string;
  readonly eventType: string;
  readonly title: string;
  readonly body: string;
  readonly ctaLabel: string | null;
  readonly ctaHref: string | null;
  readonly readAt: string | null;
  readonly createdAt: string;
}

/**
 * The read/write outcomes (T1e). A provider failure is `unavailable`, distinct
 * from a genuinely empty or unchanged result, so a caller can never answer 200
 * with empty data when the lookup actually broke.
 */
export type ListByRecipientResult =
  | { readonly ok: true; readonly notifications: readonly StoredNotification[] }
  | { readonly ok: false; readonly code: "unavailable" };

export type CountUnreadResult =
  | { readonly ok: true; readonly unread: number }
  | { readonly ok: false; readonly code: "unavailable" };

export type MarkReadResult =
  | { readonly ok: true; readonly changed: boolean }
  | { readonly ok: false; readonly code: "unavailable" };

export type MarkAllReadResult =
  | { readonly ok: true; readonly updated: number }
  | { readonly ok: false; readonly code: "unavailable" };

export interface NotificationRepositoryPort {
  /** Every active profile with the given role and an email (one or more recipients). */
  resolveRecipientsByRole(role: Role): Promise<ResolveRecipientsResult>;

  /**
   * The active profiles among exactly these user ids that have an email — the
   * addressed counterpart to `resolveRecipientsByRole`, for an event that
   * targets one known owner rather than every member of a role. The input is
   * never empty-broadcast: an empty input or a genuine no-match is `ok` with an
   * empty list, and only a provider failure is `unavailable`.
   */
  resolveRecipientsByUserIds(userIds: readonly string[]): Promise<ResolveRecipientsResult>;

  /**
   * Enqueues one notification per recipient, idempotent on
   * `(event_key, recipient_user_id)`: a replayed event returns `inserted: false`
   * with the existing row's id instead of inserting a duplicate.
   */
  insertIfAbsent(notification: NewNotification): Promise<InsertIfAbsentResult>;

  /** Records deliverability, not intent: called once Resend accepted the message. */
  markEmailSent(id: string, sentAt: string): Promise<void>;

  /** The recipient's notifications, newest first (the bell dropdown). */
  listByRecipient(recipientUserId: string): Promise<ListByRecipientResult>;

  /** The unread badge count. */
  countUnread(recipientUserId: string): Promise<CountUnreadResult>;

  /**
   * Marks one notification read, scoped to its owner. Success carries whether
   * a row changed, so the route can answer 404 when none matched.
   */
  markRead(recipientUserId: string, id: string): Promise<MarkReadResult>;

  /** Marks every unread notification read, scoped to its owner. Returns the count changed. */
  markAllRead(recipientUserId: string): Promise<MarkAllReadResult>;
}
