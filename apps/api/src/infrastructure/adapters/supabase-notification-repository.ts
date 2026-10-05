import type { PostgrestError } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "../../application/ports/auth-port.js";
import type {
  CountUnreadResult,
  InsertIfAbsentResult,
  ListByRecipientResult,
  MarkAllReadResult,
  MarkReadResult,
  NewNotification,
  NotificationRecipient,
  NotificationRepositoryPort,
  ResolveRecipientsResult,
  StoredNotification
} from "../../application/ports/notification-repository-port.js";

/**
 * Supabase adapter for the notification store and its recipient directory
 * (Feature #382, Task #383 / T1b-2).
 *
 * The API connects as `service_role`, so every write here bypasses RLS and is
 * the single enforcement point; reads through the bell run as the signed-in
 * user and are additionally scoped by `recipient_user_id`. Provider errors are
 * logged with their `code`/`message`/`details`/`hint` for operators and never
 * cross this boundary — the port's methods return sanitized results only.
 *
 * `resolveRecipientsByRole` needs an address to email. `public.profile` stores
 * the authoritative role but not the email: the address lives on the Auth user
 * (`auth.users.email`), so it is read through the Auth Admin API — the same
 * `service_role` path the superadmin seed uses. A profile without an email is
 * dropped rather than returned as a half-built recipient.
 */

const NOTIFICATION_TABLE = "notification";
const PROFILE_TABLE = "profile";
const LIST_PAGE_SIZE = 200;
const LIST_MAX_PAGES = 50;

interface ProfileRow {
  readonly user_id?: unknown;
}

interface NotificationColumns {
  readonly id?: unknown;
  readonly recipient_user_id?: unknown;
  readonly event_key?: unknown;
  readonly event_type?: unknown;
  readonly title?: unknown;
  readonly body?: unknown;
  readonly cta_label?: unknown;
  readonly cta_href?: unknown;
  readonly read_at?: unknown;
  readonly created_at?: unknown;
}

interface ProviderErrorLike {
  readonly code?: unknown;
  readonly message?: unknown;
  readonly details?: unknown;
  readonly hint?: unknown;
  readonly status?: unknown;
}

export class SupabaseNotificationRepository implements NotificationRepositoryPort {
  constructor(private readonly client: SupabaseClient) {}

  async resolveRecipientsByRole(role: Role): Promise<ResolveRecipientsResult> {
    try {
      const { data, error } = await this.client
        .from(PROFILE_TABLE)
        .select("user_id")
        .eq("role", role)
        .eq("status", "active");

      if (error) {
        this.logProviderError("resolveRecipientsByRole", error);
        return { ok: false, code: "unavailable" };
      }

      const rows = Array.isArray(data) ? (data as ProfileRow[]) : [];
      const userIds: string[] = [];
      for (const row of rows) {
        if (typeof row.user_id === "string") {
          userIds.push(row.user_id);
        }
      }

      if (userIds.length === 0) {
        return { ok: true, recipients: [] };
      }

      const emails = await this.listEmailsById();
      if (emails === undefined) {
        return { ok: false, code: "unavailable" };
      }

      const recipients: NotificationRecipient[] = [];
      for (const userId of userIds) {
        const email = emails.get(userId);
        if (email !== undefined) {
          recipients.push({ userId, email });
        }
      }
      return { ok: true, recipients };
    } catch (cause) {
      this.logUnexpected("resolveRecipientsByRole", cause);
      return { ok: false, code: "unavailable" };
    }
  }

  async insertIfAbsent(notification: NewNotification): Promise<InsertIfAbsentResult> {
    try {
      const { data, error } = await this.client
        .from(NOTIFICATION_TABLE)
        .upsert(
          {
            recipient_user_id: notification.recipientUserId,
            event_key: notification.eventKey,
            event_type: notification.eventType,
            title: notification.title,
            body: notification.body,
            cta_label: notification.ctaLabel,
            cta_href: notification.ctaHref
          },
          { onConflict: "event_key,recipient_user_id", ignoreDuplicates: true }
        )
        .select("id");

      if (error) {
        this.logProviderError("insertIfAbsent", error);
        return { ok: false, code: "unavailable" };
      }

      const insertedId = firstId(data);
      if (insertedId !== undefined) {
        return { ok: true, inserted: true, id: insertedId };
      }

      // `ON CONFLICT DO NOTHING` returned no row: the event was already enqueued
      // for this recipient, so the port reports the existing row's id. A failed
      // read-back is a real failure, not an empty id, so it is `unavailable`.
      const existingId = await this.readExistingId(notification);
      return existingId === undefined
        ? { ok: false, code: "unavailable" }
        : { ok: true, inserted: false, id: existingId };
    } catch (cause) {
      this.logUnexpected("insertIfAbsent", cause);
      return { ok: false, code: "unavailable" };
    }
  }

  async markEmailSent(id: string, sentAt: string): Promise<void> {
    try {
      const { error } = await this.client
        .from(NOTIFICATION_TABLE)
        .update({ email_sent_at: sentAt })
        .eq("id", id);

      if (error) {
        this.logProviderError("markEmailSent", error);
      }
    } catch (cause) {
      this.logUnexpected("markEmailSent", cause);
    }
  }

  async listByRecipient(recipientUserId: string): Promise<ListByRecipientResult> {
    try {
      const { data, error } = await this.client
        .from(NOTIFICATION_TABLE)
        .select(
          "id, recipient_user_id, event_key, event_type, title, body, cta_label, cta_href, read_at, created_at"
        )
        .eq("recipient_user_id", recipientUserId)
        .order("created_at", { ascending: false });

      if (error) {
        this.logProviderError("listByRecipient", error);
        return { ok: false, code: "unavailable" };
      }

      const rows = Array.isArray(data) ? (data as NotificationColumns[]) : [];
      const notifications: StoredNotification[] = [];
      for (const row of rows) {
        const mapped = this.toStoredNotification(row);
        if (mapped === undefined) {
          this.logUnexpected("listByRecipient", new Error("malformed notification row"));
          continue;
        }
        notifications.push(mapped);
      }
      return { ok: true, notifications };
    } catch (cause) {
      this.logUnexpected("listByRecipient", cause);
      return { ok: false, code: "unavailable" };
    }
  }

  async countUnread(recipientUserId: string): Promise<CountUnreadResult> {
    try {
      const { count, error } = await this.client
        .from(NOTIFICATION_TABLE)
        .select("id", { count: "exact", head: true })
        .eq("recipient_user_id", recipientUserId)
        .is("read_at", null);

      if (error) {
        this.logProviderError("countUnread", error);
        return { ok: false, code: "unavailable" };
      }

      return { ok: true, unread: typeof count === "number" ? count : 0 };
    } catch (cause) {
      this.logUnexpected("countUnread", cause);
      return { ok: false, code: "unavailable" };
    }
  }

  async markRead(recipientUserId: string, id: string): Promise<MarkReadResult> {
    try {
      const { data, error } = await this.client
        .from(NOTIFICATION_TABLE)
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .eq("recipient_user_id", recipientUserId)
        .is("read_at", null)
        .select("id");

      if (error) {
        this.logProviderError("markRead", error);
        return { ok: false, code: "unavailable" };
      }

      return { ok: true, changed: Array.isArray(data) && data.length > 0 };
    } catch (cause) {
      this.logUnexpected("markRead", cause);
      return { ok: false, code: "unavailable" };
    }
  }

  async markAllRead(recipientUserId: string): Promise<MarkAllReadResult> {
    try {
      const { data, error } = await this.client
        .from(NOTIFICATION_TABLE)
        .update({ read_at: new Date().toISOString() })
        .eq("recipient_user_id", recipientUserId)
        .is("read_at", null)
        .select("id");

      if (error) {
        this.logProviderError("markAllRead", error);
        return { ok: false, code: "unavailable" };
      }

      return { ok: true, updated: Array.isArray(data) ? data.length : 0 };
    } catch (cause) {
      this.logUnexpected("markAllRead", cause);
      return { ok: false, code: "unavailable" };
    }
  }

  /** Reads the existing id after a conflict; `undefined` means it could not be read. */
  private async readExistingId(notification: NewNotification): Promise<string | undefined> {
    try {
      const { data, error } = await this.client
        .from(NOTIFICATION_TABLE)
        .select("id")
        .eq("event_key", notification.eventKey)
        .eq("recipient_user_id", notification.recipientUserId)
        .maybeSingle();

      if (error) {
        this.logProviderError("insertIfAbsent(read-back)", error);
        return undefined;
      }

      const id = data !== null && typeof data === "object" && "id" in data ? data.id : undefined;
      return typeof id === "string" ? id : undefined;
    } catch (cause) {
      this.logUnexpected("insertIfAbsent(read-back)", cause);
      return undefined;
    }
  }

  /**
   * Reads the Auth directory's emails, paginated like the superadmin seed, and
   * returns `id → email`. A failure yields `undefined`, so the caller reports
   * `unavailable` rather than fanning out to no one (or half the recipients).
   *
   * A full last page at the cap means there may be recipients beyond it, so the
   * map is not known to be complete: it yields `undefined` (unavailable) rather
   * than a silently partial directory.
   */
  private async listEmailsById(): Promise<Map<string, string> | undefined> {
    const byId = new Map<string, string>();
    let complete = false;
    try {
      for (let page = 1; page <= LIST_MAX_PAGES; page += 1) {
        const { data, error } = await this.client.auth.admin.listUsers({
          page,
          perPage: LIST_PAGE_SIZE
        });

        if (error) {
          this.logProviderError("resolveRecipientsByRole(listUsers)", error);
          return undefined;
        }

        const users = data?.users ?? [];
        for (const user of users) {
          if (typeof user.id === "string" && typeof user.email === "string" && user.email.length > 0) {
            byId.set(user.id, user.email);
          }
        }

        if (users.length < LIST_PAGE_SIZE) {
          complete = true;
          break;
        }
      }
    } catch (cause) {
      this.logUnexpected("resolveRecipientsByRole(listUsers)", cause);
      return undefined;
    }

    return complete ? byId : undefined;
  }

  private toStoredNotification(row: NotificationColumns): StoredNotification | undefined {
    const id = row.id;
    const recipientUserId = row.recipient_user_id;
    const eventKey = row.event_key;
    const eventType = row.event_type;
    const title = row.title;
    const body = row.body;
    const createdAt = row.created_at;

    if (
      typeof id !== "string" ||
      typeof recipientUserId !== "string" ||
      typeof eventKey !== "string" ||
      typeof eventType !== "string" ||
      typeof title !== "string" ||
      typeof body !== "string" ||
      typeof createdAt !== "string"
    ) {
      return undefined;
    }

    return {
      id,
      recipientUserId,
      eventKey,
      eventType,
      title,
      body,
      ctaLabel: typeof row.cta_label === "string" ? row.cta_label : null,
      ctaHref: typeof row.cta_href === "string" ? row.cta_href : null,
      readAt: typeof row.read_at === "string" ? row.read_at : null,
      createdAt
    };
  }

  private logProviderError(operation: string, error: ProviderErrorLike | PostgrestError): void {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error(`[SupabaseNotificationRepository] ${operation} error`, {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      status: "status" in error ? error.status : undefined
    });
  }

  private logUnexpected(operation: string, cause: unknown): void {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error(`[SupabaseNotificationRepository] ${operation} threw`, {
      cause: cause instanceof Error ? cause.name : "unknown"
    });
  }
}

function firstId(data: unknown): string | undefined {
  if (!Array.isArray(data)) {
    return undefined;
  }
  const first = (data as Array<{ readonly id?: unknown }>)[0];
  return first !== undefined && typeof first.id === "string" && first.id.length > 0
    ? first.id
    : undefined;
}
