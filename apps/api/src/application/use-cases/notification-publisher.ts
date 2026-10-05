import {
  NOTIFICATION_AUDIENCE,
  renderEmail,
  renderInApp
} from "../notifications/notification-catalogue.js";
import type { Role } from "../ports/auth-port.js";
import type { EmailPort } from "../ports/email-port.js";
import type {
  InsertIfAbsentResult,
  NotificationRepositoryPort,
  ResolveRecipientsResult
} from "../ports/notification-repository-port.js";
import type {
  NotificationEvent,
  NotificationPublisherPort,
  PublishSummary
} from "../ports/notification-publisher-port.js";

/**
 * Publishes one notification event (Feature #382, Task #383 / T1b-2).
 *
 * The catalogue decides *what* each event says; the repository persists one
 * in-app row per recipient, idempotent on `(event_key, recipient_user_id)`, and
 * the email port delivers the same copy. Publishing is best-effort: a recipient
 * whose email fails is counted, never thrown, so the action that raised the
 * event always completes. Persistence failures — an unavailable recipient
 * lookup or a failed in-app insert — are reported as `failed: true` in the
 * summary and never thrown, so the caller can tell a real repository failure
 * from an audience with nobody in it.
 *
 * The only failure that throws is a programming error: the event's `type` and
 * its payload's `type` disagreeing, which is a defect in the producer, not a
 * delivery failure to swallow.
 */
export class NotificationPublisher implements NotificationPublisherPort {
  constructor(
    private readonly dependencies: {
      readonly repository: NotificationRepositoryPort;
      readonly email: EmailPort;
      readonly appBaseUrl: string;
    }
  ) {}

  async publish(event: NotificationEvent): Promise<PublishSummary> {
    if (event.type !== event.payload.type) {
      throw new Error(
        `notification event type mismatch: ${event.type} !== ${event.payload.type}`
      );
    }

    const role = NOTIFICATION_AUDIENCE[event.type];
    const resolved = await this.resolveRecipients(role);
    if (!resolved.ok) {
      return { recipients: 0, inserted: 0, skipped: 0, emailsSent: 0, emailsFailed: 0, failed: true };
    }
    const recipients = resolved.recipients;

    const inApp = renderInApp(event.payload);
    const email = renderEmail(event.payload, this.dependencies.appBaseUrl);
    const sentAt = new Date().toISOString();

    let inserted = 0;
    let skipped = 0;
    let emailsSent = 0;
    let emailsFailed = 0;
    let failedInserted = 0;

    for (const recipient of recipients) {
      const stored = await this.insertForRecipient(event, recipient.userId, inApp);
      if (!stored.ok) {
        // The in-app row could not be persisted: not a replay, a real failure.
        failedInserted += 1;
        continue;
      }

      if (!stored.inserted) {
        skipped += 1;
        continue;
      }

      inserted += 1;

      const delivered = await this.sendEmail(recipient.email, email.subject, email.body);
      if (!delivered) {
        emailsFailed += 1;
        continue;
      }

      emailsSent += 1;
      // Recording delivery is bookkeeping, not the send: a failed stamp must not
      // turn a delivered email into a failure the caller sees.
      await this.markEmailSent(stored.id, sentAt);
    }

    return {
      recipients: recipients.length,
      inserted,
      skipped,
      emailsSent,
      emailsFailed,
      failed: failedInserted > 0
    };
  }

  /**
   * A directory failure (or a non-conforming throwing port) is contained and
   * reported as `unavailable`; the caller decides what to do with `failed`.
   */
  private async resolveRecipients(role: Role): Promise<ResolveRecipientsResult> {
    try {
      return await this.dependencies.repository.resolveRecipientsByRole(role);
    } catch {
      return { ok: false, code: "unavailable" };
    }
  }

  private async insertForRecipient(
    event: NotificationEvent,
    recipientUserId: string,
    inApp: ReturnType<typeof renderInApp>
  ): Promise<InsertIfAbsentResult> {
    try {
      return await this.dependencies.repository.insertIfAbsent({
        recipientUserId,
        eventKey: event.eventKey,
        eventType: event.type,
        title: inApp.title,
        body: inApp.body,
        ctaLabel: inApp.ctaLabel ?? null,
        ctaHref: inApp.ctaHref ?? null
      });
    } catch {
      return { ok: false, code: "unavailable" };
    }
  }

  /** `send` never throws by contract; a non-conforming port is still contained. */
  private async sendEmail(to: string, subject: string, text: string): Promise<boolean> {
    try {
      const result = await this.dependencies.email.send({ to, subject, text });
      return result.ok;
    } catch {
      return false;
    }
  }

  private async markEmailSent(id: string, sentAt: string): Promise<void> {
    try {
      await this.dependencies.repository.markEmailSent(id, sentAt);
    } catch {
      // Bookkeeping only; the notification and the email already happened.
    }
  }
}
