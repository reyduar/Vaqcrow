import { describe, expect, it } from "vitest";
import type { EmailMessage, EmailPort, EmailSendResult } from "../ports/email-port.js";
import type {
  NewNotification,
  NotificationRecipient,
  NotificationRepositoryPort,
  StoredNotification
} from "../ports/notification-repository-port.js";
import type { NotificationEvent } from "../ports/notification-publisher-port.js";
import { NotificationPublisher } from "./notification-publisher.js";

const ADMIN = "00000000-0000-4000-8000-000000000001";
const ADMIN_TWO = "00000000-0000-4000-8000-000000000002";
const APP_BASE_URL = "http://localhost:3001";

const NEW_APPLICATION_EVENT: NotificationEvent = {
  eventKey: "application:11111111-1111-4111-8111-111111111111:submitted",
  type: "admin.new_application",
  payload: { type: "admin.new_application", smeName: "Panadería Horizonte SRL" }
};

class InMemoryNotificationRepository implements NotificationRepositoryPort {
  recipients: readonly NotificationRecipient[] = [];
  throwOnResolve = false;
  insertFailure = false;
  readonly inserted: NewNotification[] = [];
  readonly markedSent: Array<{ id: string; sentAt: string }> = [];
  readonly stored = new Map<string, { id: string; notification: NewNotification }>();
  private sequence = 0;

  async resolveRecipientsByRole(): Promise<readonly NotificationRecipient[]> {
    if (this.throwOnResolve) {
      throw new Error("directory unavailable");
    }
    return this.recipients;
  }

  async insertIfAbsent(notification: NewNotification): Promise<{ inserted: boolean; id: string }> {
    if (this.insertFailure) {
      throw new Error("insert unavailable");
    }
    const key = `${notification.eventKey}|${notification.recipientUserId}`;
    const existing = this.stored.get(key);
    if (existing !== undefined) {
      return { inserted: false, id: existing.id };
    }
    this.sequence += 1;
    const id = `notification-${this.sequence}`;
    this.stored.set(key, { id, notification });
    this.inserted.push(notification);
    return { inserted: true, id };
  }

  async markEmailSent(id: string, sentAt: string): Promise<void> {
    this.markedSent.push({ id, sentAt });
  }

  async listByRecipient(): Promise<readonly StoredNotification[]> {
    return [];
  }

  async countUnread(): Promise<number> {
    return 0;
  }

  async markRead(): Promise<boolean> {
    return false;
  }

  async markAllRead(): Promise<number> {
    return 0;
  }
}

class FakeEmail implements EmailPort {
  readonly messages: EmailMessage[] = [];
  result: EmailSendResult = { ok: true, id: "email-1" };
  throwOnSend = false;

  async send(message: EmailMessage): Promise<EmailSendResult> {
    this.messages.push(message);
    if (this.throwOnSend) {
      throw new Error("resend unavailable");
    }
    return this.result;
  }
}

function setup() {
  const repository = new InMemoryNotificationRepository();
  const email = new FakeEmail();
  const publisher = new NotificationPublisher({ repository, email, appBaseUrl: APP_BASE_URL });
  return { repository, email, publisher };
}

describe("NotificationPublisher.publish", () => {
  it("fans out to every recipient of the role, persists and emails each one", async () => {
    const { repository, email, publisher } = setup();
    repository.recipients = [
      { userId: ADMIN, email: "admin@example.test" },
      { userId: ADMIN_TWO, email: "admin2@example.test" }
    ];

    const summary = await publisher.publish(NEW_APPLICATION_EVENT);

    expect(summary).toEqual({ inserted: 2, skipped: 0, emailsSent: 2, emailsFailed: 0 });
    expect(repository.inserted).toHaveLength(2);
    expect(repository.inserted[0]).toMatchObject({
      recipientUserId: ADMIN,
      eventKey: NEW_APPLICATION_EVENT.eventKey,
      eventType: "admin.new_application",
      title: "Nueva solicitud: Panadería Horizonte SRL",
      ctaLabel: "Revisar solicitud",
      ctaHref: "/admin"
    });
    expect(repository.inserted[1]?.recipientUserId).toBe(ADMIN_TWO);
    expect(email.messages).toHaveLength(2);
    expect(email.messages[0]).toEqual({
      to: "admin@example.test",
      subject: "Nueva solicitud: Panadería Horizonte SRL",
      text: expect.stringContaining("Revisar solicitud: http://localhost:3001/admin")
    });
    expect(repository.markedSent).toHaveLength(2);
  });

  it("is idempotent on a replayed event: a conflict is skipped with no second email", async () => {
    const { repository, email, publisher } = setup();
    repository.recipients = [{ userId: ADMIN, email: "admin@example.test" }];

    const first = await publisher.publish(NEW_APPLICATION_EVENT);
    const replay = await publisher.publish(NEW_APPLICATION_EVENT);

    expect(first).toEqual({ inserted: 1, skipped: 0, emailsSent: 1, emailsFailed: 0 });
    expect(replay).toEqual({ inserted: 0, skipped: 1, emailsSent: 0, emailsFailed: 0 });
    expect(email.messages).toHaveLength(1);
    expect(repository.markedSent).toHaveLength(1);
  });

  it("counts a failed email and still delivers to the other recipients without throwing", async () => {
    const { repository, email, publisher } = setup();
    repository.recipients = [
      { userId: ADMIN, email: "admin@example.test" },
      { userId: ADMIN_TWO, email: "admin2@example.test" }
    ];
    email.throwOnSend = true;

    const summary = await publisher.publish(NEW_APPLICATION_EVENT);

    expect(summary).toEqual({ inserted: 2, skipped: 0, emailsSent: 0, emailsFailed: 2 });
    expect(repository.markedSent).toHaveLength(0);
  });

  it("counts an ok:false result as a failure and keeps going", async () => {
    const { repository, email, publisher } = setup();
    repository.recipients = [
      { userId: ADMIN, email: "admin@example.test" },
      { userId: ADMIN_TWO, email: "admin2@example.test" }
    ];
    email.result = { ok: false, code: "unavailable" };

    const summary = await publisher.publish(NEW_APPLICATION_EVENT);

    expect(summary).toEqual({ inserted: 2, skipped: 0, emailsSent: 0, emailsFailed: 2 });
    expect(repository.markedSent).toHaveLength(0);
  });

  it("resolves with an empty summary when the recipient lookup fails", async () => {
    const { repository, publisher } = setup();
    repository.throwOnResolve = true;

    expect(await publisher.publish(NEW_APPLICATION_EVENT)).toEqual({
      inserted: 0,
      skipped: 0,
      emailsSent: 0,
      emailsFailed: 0
    });
  });

  it("skips a recipient whose in-app insert fails without throwing", async () => {
    const { repository, publisher } = setup();
    repository.recipients = [{ userId: ADMIN, email: "admin@example.test" }];
    repository.insertFailure = true;

    expect(await publisher.publish(NEW_APPLICATION_EVENT)).toEqual({
      inserted: 0,
      skipped: 1,
      emailsSent: 0,
      emailsFailed: 0
    });
  });

  it("throws when the event type disagrees with its payload (a programming error)", async () => {
    const { publisher } = setup();
    const mismatched = {
      eventKey: "x",
      type: "admin.new_application",
      payload: { type: "pyme.approved_published" }
    } as unknown as NotificationEvent;

    await expect(publisher.publish(mismatched)).rejects.toThrow(/type mismatch/);
  });
});
