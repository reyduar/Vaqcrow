import { describe, expect, it } from "vitest";
import type { Role } from "../ports/auth-port.js";
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
  smeName: "Panadería Horizonte SRL"
};

/**
 * A PyME event and an investor event: the publisher must resolve each against
 * its own `NOTIFICATION_AUDIENCE` role. The catalogue asserts the map in
 * isolation; these cases prove the use case actually fans out by it, so a
 * regression in `publish` (e.g. resolving always as ADMIN) cannot hide behind a
 * correct map.
 */
const PYME_APPROVED_EVENT: NotificationEvent = {
  eventKey: "application:22222222-2222-4222-8222-222222222222:approved",
  type: "pyme.approved_published"
};

const INVESTOR_CONTRIBUTION_EVENT: NotificationEvent = {
  eventKey: "contribution:33333333-3333-4333-8333-333333333333:confirmed",
  type: "investor.contribution_confirmed",
  smeName: "Panadería Horizonte SRL"
};

class InMemoryNotificationRepository implements NotificationRepositoryPort {
  recipients: readonly NotificationRecipient[] = [];
  /** Every role the publisher asked the directory for, in order. */
  readonly resolvedRoles: Role[] = [];
  throwOnResolve = false;
  resolveFailure = false;
  insertFailure = false;
  throwOnInsert = false;
  throwOnMarkEmailSent = false;
  readonly inserted: NewNotification[] = [];
  readonly markedSent: Array<{ id: string; sentAt: string }> = [];
  readonly stored = new Map<string, { id: string; notification: NewNotification }>();
  private sequence = 0;

  async resolveRecipientsByRole(role: Role): Promise<
    { readonly ok: true; readonly recipients: readonly NotificationRecipient[] } | { readonly ok: false; readonly code: "unavailable" }
  > {
    this.resolvedRoles.push(role);
    if (this.throwOnResolve) {
      throw new Error("directory unavailable");
    }
    if (this.resolveFailure) {
      return { ok: false, code: "unavailable" };
    }
    return { ok: true, recipients: this.recipients };
  }

  async insertIfAbsent(
    notification: NewNotification
  ): Promise<{ readonly ok: true; readonly inserted: boolean; readonly id: string } | { readonly ok: false; readonly code: "unavailable" }> {
    if (this.throwOnInsert) {
      throw new Error("insert unavailable");
    }
    if (this.insertFailure) {
      return { ok: false, code: "unavailable" };
    }
    const key = `${notification.eventKey}|${notification.recipientUserId}`;
    const existing = this.stored.get(key);
    if (existing !== undefined) {
      return { ok: true, inserted: false, id: existing.id };
    }
    this.sequence += 1;
    const id = `notification-${this.sequence}`;
    this.stored.set(key, { id, notification });
    this.inserted.push(notification);
    return { ok: true, inserted: true, id };
  }

  async markEmailSent(id: string, sentAt: string): Promise<void> {
    if (this.throwOnMarkEmailSent) {
      throw new Error("stamp unavailable");
    }
    this.markedSent.push({ id, sentAt });
  }

  async listByRecipient(): Promise<
    { readonly ok: true; readonly notifications: readonly StoredNotification[] } | { readonly ok: false; readonly code: "unavailable" }
  > {
    return { ok: true, notifications: [] };
  }

  async countUnread(): Promise<
    { readonly ok: true; readonly unread: number } | { readonly ok: false; readonly code: "unavailable" }
  > {
    return { ok: true, unread: 0 };
  }

  async markRead(): Promise<
    { readonly ok: true; readonly changed: boolean } | { readonly ok: false; readonly code: "unavailable" }
  > {
    return { ok: true, changed: false };
  }

  async markAllRead(): Promise<
    { readonly ok: true; readonly updated: number } | { readonly ok: false; readonly code: "unavailable" }
  > {
    return { ok: true, updated: 0 };
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

    expect(summary).toEqual({ recipients: 2, inserted: 2, skipped: 0, emailsSent: 2, emailsFailed: 0, failed: false });
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

    expect(first).toEqual({ recipients: 1, inserted: 1, skipped: 0, emailsSent: 1, emailsFailed: 0, failed: false });
    expect(replay).toEqual({ recipients: 1, inserted: 0, skipped: 1, emailsSent: 0, emailsFailed: 0, failed: false });
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

    expect(summary).toEqual({ recipients: 2, inserted: 2, skipped: 0, emailsSent: 0, emailsFailed: 2, failed: false });
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

    expect(summary).toEqual({ recipients: 2, inserted: 2, skipped: 0, emailsSent: 0, emailsFailed: 2, failed: false });
    expect(repository.markedSent).toHaveLength(0);
  });

  it("reports failed and resolves when the recipient lookup reports unavailable", async () => {
    const { repository, publisher } = setup();
    repository.resolveFailure = true;

    expect(await publisher.publish(NEW_APPLICATION_EVENT)).toEqual({
      recipients: 0,
      inserted: 0,
      skipped: 0,
      emailsSent: 0,
      emailsFailed: 0,
      failed: true
    });
  });

  it("contains a throwing directory and reports failed without throwing", async () => {
    const { repository, publisher } = setup();
    repository.throwOnResolve = true;

    expect(await publisher.publish(NEW_APPLICATION_EVENT)).toEqual({
      recipients: 0,
      inserted: 0,
      skipped: 0,
      emailsSent: 0,
      emailsFailed: 0,
      failed: true
    });
  });

  it("counts a recipient whose in-app insert reports unavailable as failed and continues", async () => {
    const { repository, publisher } = setup();
    repository.recipients = [{ userId: ADMIN, email: "admin@example.test" }];
    repository.insertFailure = true;

    expect(await publisher.publish(NEW_APPLICATION_EVENT)).toEqual({
      recipients: 1,
      inserted: 0,
      skipped: 0,
      emailsSent: 0,
      emailsFailed: 0,
      failed: true
    });
  });

  it("contains a throwing insert and reports failed without throwing", async () => {
    const { repository, publisher } = setup();
    repository.recipients = [{ userId: ADMIN, email: "admin@example.test" }];
    repository.throwOnInsert = true;

    expect(await publisher.publish(NEW_APPLICATION_EVENT)).toEqual({
      recipients: 1,
      inserted: 0,
      skipped: 0,
      emailsSent: 0,
      emailsFailed: 0,
      failed: true
    });
  });

  it("still counts a delivered email when the markEmailSent stamp throws", async () => {
    const { repository, email, publisher } = setup();
    repository.recipients = [{ userId: ADMIN, email: "admin@example.test" }];
    repository.throwOnMarkEmailSent = true;

    const summary = await publisher.publish(NEW_APPLICATION_EVENT);

    // The email was accepted by the provider: a failed bookkeeping stamp must
    // not turn that delivery into a failure the caller sees.
    expect(summary).toEqual({ recipients: 1, inserted: 1, skipped: 0, emailsSent: 1, emailsFailed: 0, failed: false });
    expect(email.messages).toHaveLength(1);
    expect(repository.markedSent).toHaveLength(0);
  });
});

describe("NotificationPublisher.publish audience resolution", () => {
  const CASES = [
    {
      label: "PyME",
      event: PYME_APPROVED_EVENT,
      role: "PYME" as Role,
      title: "Tu campaña fue aprobada y publicada",
      ctaHref: "/company"
    },
    {
      label: "investor",
      event: INVESTOR_CONTRIBUTION_EVENT,
      role: "INVERSOR" as Role,
      title: "Tu aporte se confirmó",
      ctaHref: "/portfolio"
    }
  ] as const;

  it.each(CASES)("resolves the $role audience and persists its own copy for a $label event", async (entry) => {
    const { repository, email, publisher } = setup();
    repository.recipients = [{ userId: ADMIN, email: "recipient@example.test" }];

    const summary = await publisher.publish(entry.event);

    expect(repository.resolvedRoles).toEqual([entry.role]);
    expect(summary).toEqual({ recipients: 1, inserted: 1, skipped: 0, emailsSent: 1, emailsFailed: 0, failed: false });
    expect(repository.inserted[0]).toMatchObject({
      recipientUserId: ADMIN,
      eventKey: entry.event.eventKey,
      eventType: entry.event.type,
      title: entry.title,
      ctaHref: entry.ctaHref
    });
    expect(email.messages[0]?.text).toContain(`${APP_BASE_URL}${entry.ctaHref}`);
  });

  it("resolves each role from the event it is given, independently per publish", async () => {
    const { repository, publisher } = setup();
    repository.recipients = [{ userId: ADMIN, email: "recipient@example.test" }];

    await publisher.publish(INVESTOR_CONTRIBUTION_EVENT);
    await publisher.publish(PYME_APPROVED_EVENT);
    await publisher.publish(NEW_APPLICATION_EVENT);

    expect(repository.resolvedRoles).toEqual(["INVERSOR", "PYME", "ADMIN"]);
  });
});
