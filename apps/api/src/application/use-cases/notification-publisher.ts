import {
  NOTIFICATION_AUDIENCE,
  renderEmail,
  renderInApp
} from "../notifications/notification-catalogue.js";
import type { Role } from "../ports/auth-port.js";
import type { EmailPort } from "../ports/email-port.js";
import type {
  NotificationRecipient,
  NotificationRepositoryPort
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
 * event always completes.
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
    const recipients = await this.resolveRecipients(role);

    const inApp = renderInApp(event.payload);
    const email = renderEmail(event.payload, this.dependencies.appBaseUrl);
    const sentAt = new Date().toISOString();

    let inserted = 0;
    let skipped = 0;
    let emailsSent = 0;
    let emailsFailed = 0;

    for (const recipient of recipients) {
      const stored = await this.insertForRecipient(event, recipient.userId, inApp);
      if (stored === undefined) {
        skipped += 1;
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

    return { inserted, skipped, emailsSent, emailsFailed };
  }

  /** A directory failure means no recipients; publishing stays best-effort. */
  private async resolveRecipients(role: Role): Promise<readonly NotificationRecipient[]> {
    try {
      return await this.dependencies.repository.resolveRecipientsByRole(role);
    } catch {
      return [];
    }
  }

  private async insertForRecipient(
    event: NotificationEvent,
    recipientUserId: string,
    inApp: ReturnType<typeof renderInApp>
  ): Promise<{ readonly inserted: boolean; readonly id: string } | undefined> {
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
      return undefined;
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
