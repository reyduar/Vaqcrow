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

export interface NotificationRepositoryPort {
  /** Every active profile with the given role and an email (one or more recipients). */
  resolveRecipientsByRole(role: Role): Promise<readonly NotificationRecipient[]>;

  /**
   * Enqueues one notification per recipient, idempotent on
   * `(event_key, recipient_user_id)`: a replayed event returns `inserted: false`
   * with the existing row's id instead of inserting a duplicate.
   */
  insertIfAbsent(
    notification: NewNotification
  ): Promise<{ readonly inserted: boolean; readonly id: string }>;

  /** Records deliverability, not intent: called once Resend accepted the message. */
  markEmailSent(id: string, sentAt: string): Promise<void>;

  /** The recipient's notifications, newest first (the bell dropdown). */
  listByRecipient(recipientUserId: string): Promise<readonly StoredNotification[]>;

  /** The unread badge count. */
  countUnread(recipientUserId: string): Promise<number>;

  /** Marks one notification read, scoped to its owner. Returns false when none matched. */
  markRead(recipientUserId: string, id: string): Promise<boolean>;

  /** Marks every unread notification read, scoped to its owner. Returns the count changed. */
  markAllRead(recipientUserId: string): Promise<number>;
}
