import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type {
  CountUnreadResult,
  ListByRecipientResult,
  MarkAllReadResult,
  MarkReadResult,
  NotificationRecipient,
  NotificationRepositoryPort,
  StoredNotification
} from "../../../application/ports/notification-repository-port.js";
import { buildAppAs, principalFor } from "../test-support/auth.js";
import type { NotificationRouteDependencies } from "./notification.route.js";

const CALLER_ID = principalFor("PYME").userId;
const OTHER_ID = principalFor("INVERSOR").userId;
const NOTIFICATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const STORED_NOTIFICATION: StoredNotification = {
  id: NOTIFICATION_ID,
  recipientUserId: CALLER_ID,
  eventKey: "application:11111111-1111-4111-8111-111111111111:submitted",
  eventType: "admin.new_application",
  title: "Nueva solicitud: Panadería Horizonte SRL",
  body: "Panadería Horizonte SRL envió su solicitud a revisión.",
  ctaLabel: "Revisar solicitud",
  ctaHref: "/admin",
  readAt: null,
  createdAt: "2026-10-04T12:00:00.000Z"
};

interface FakeRepository {
  readonly repository: NotificationRepositoryPort;
  readonly listCalls: string[];
  readonly countCalls: string[];
  readonly markReadCalls: Array<{ userId: string; id: string }>;
  readonly markAllCalls: string[];
}

function fakeRepository(overrides: Partial<NotificationRepositoryPort> = {}): FakeRepository {
  const listCalls: string[] = [];
  const countCalls: string[] = [];
  const markReadCalls: Array<{ userId: string; id: string }> = [];
  const markAllCalls: string[] = [];

  const repository: NotificationRepositoryPort = {
    resolveRecipientsByRole: async (): Promise<
      { readonly ok: true; readonly recipients: readonly NotificationRecipient[] } | { readonly ok: false; readonly code: "unavailable" }
    > => ({ ok: true, recipients: [] }),
    insertIfAbsent: async (): Promise<
      { readonly ok: true; readonly inserted: boolean; readonly id: string } | { readonly ok: false; readonly code: "unavailable" }
    > => ({ ok: true, inserted: true, id: NOTIFICATION_ID }),
    markEmailSent: async () => undefined,
    listByRecipient: async (recipientUserId): Promise<ListByRecipientResult> => {
      listCalls.push(recipientUserId);
      return { ok: true, notifications: [STORED_NOTIFICATION] };
    },
    countUnread: async (recipientUserId): Promise<CountUnreadResult> => {
      countCalls.push(recipientUserId);
      return { ok: true, unread: 2 };
    },
    markRead: async (recipientUserId, id): Promise<MarkReadResult> => {
      markReadCalls.push({ userId: recipientUserId, id });
      return { ok: true, changed: true };
    },
    markAllRead: async (recipientUserId): Promise<MarkAllReadResult> => {
      markAllCalls.push(recipientUserId);
      return { ok: true, updated: 3 };
    },
    ...overrides
  };

  return { repository, listCalls, countCalls, markReadCalls, markAllCalls };
}

function deps(repository: NotificationRepositoryPort): NotificationRouteDependencies {
  return { repository };
}

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("GET /notifications", () => {
  it("lists the caller's own notifications", async () => {
    const fake = fakeRepository();
    app = buildAppAs("PYME", { notification: deps(fake.repository) });

    const response = await app.inject({ method: "GET", url: "/notifications" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ notifications: [STORED_NOTIFICATION] });
    expect(fake.listCalls).toEqual([CALLER_ID]);
  });

  it("uses the verified principal, never a body/query recipient", async () => {
    const fake = fakeRepository();
    app = buildAppAs("PYME", { notification: deps(fake.repository) });

    await app.inject({ method: "GET", url: `/notifications?recipientUserId=${OTHER_ID}` });

    expect(fake.listCalls).toEqual([CALLER_ID]);
    expect(fake.listCalls).not.toContain(OTHER_ID);
  });

  it("answers 503 instead of an empty 200 when the repository is unavailable", async () => {
    const fake = fakeRepository({ listByRecipient: async () => ({ ok: false, code: "unavailable" }) });
    app = buildAppAs("PYME", { notification: deps(fake.repository) });

    const response = await app.inject({ method: "GET", url: "/notifications" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });
});

describe("GET /notifications/unread-count", () => {
  it("returns the caller's unread count", async () => {
    const fake = fakeRepository();
    app = buildAppAs("INVERSOR", { notification: deps(fake.repository) });

    const response = await app.inject({ method: "GET", url: "/notifications/unread-count" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ unread: 2 });
    expect(fake.countCalls).toEqual([principalFor("INVERSOR").userId]);
  });

  it("answers 503 instead of a zero 200 when the repository is unavailable", async () => {
    const fake = fakeRepository({ countUnread: async () => ({ ok: false, code: "unavailable" }) });
    app = buildAppAs("INVERSOR", { notification: deps(fake.repository) });

    const response = await app.inject({ method: "GET", url: "/notifications/unread-count" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });
});

describe("POST /notifications/:notificationId/read", () => {
  it("marks the caller's row read", async () => {
    const fake = fakeRepository();
    app = buildAppAs("PYME", { notification: deps(fake.repository) });

    const response = await app.inject({ method: "POST", url: `/notifications/${NOTIFICATION_ID}/read`, payload: {} });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ read: true });
    expect(fake.markReadCalls).toEqual([{ userId: CALLER_ID, id: NOTIFICATION_ID }]);
  });

  it("ignores a body-supplied recipient and uses the verified principal", async () => {
    const fake = fakeRepository();
    app = buildAppAs("PYME", { notification: deps(fake.repository) });

    await app.inject({
      method: "POST",
      url: `/notifications/${NOTIFICATION_ID}/read`,
      payload: { recipientUserId: OTHER_ID }
    });

    expect(fake.markReadCalls).toEqual([{ userId: CALLER_ID, id: NOTIFICATION_ID }]);
  });

  it("rejects a non-UUID id with 400 without touching the repository", async () => {
    const fake = fakeRepository();
    app = buildAppAs("PYME", { notification: deps(fake.repository) });

    const response = await app.inject({ method: "POST", url: "/notifications/not-a-uuid/read", payload: {} });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(fake.markReadCalls).toHaveLength(0);
  });

  it("answers 404 when the row does not exist or is not the caller's", async () => {
    const fake = fakeRepository({ markRead: async () => ({ ok: true, changed: false }) });
    app = buildAppAs("PYME", { notification: deps(fake.repository) });

    const response = await app.inject({ method: "POST", url: `/notifications/${NOTIFICATION_ID}/read`, payload: {} });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "not_found" });
  });

  it("answers 503 when the repository reports unavailable", async () => {
    const fake = fakeRepository({ markRead: async () => ({ ok: false, code: "unavailable" }) });
    app = buildAppAs("PYME", { notification: deps(fake.repository) });

    const response = await app.inject({ method: "POST", url: `/notifications/${NOTIFICATION_ID}/read`, payload: {} });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });
});

describe("POST /notifications/read-all", () => {
  it("marks every unread row read and returns the count", async () => {
    const fake = fakeRepository();
    app = buildAppAs("PYME", { notification: deps(fake.repository) });

    const response = await app.inject({ method: "POST", url: "/notifications/read-all", payload: {} });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ updated: 3 });
    expect(fake.markAllCalls).toEqual([CALLER_ID]);
  });

  it("ignores a body-supplied recipient and uses the verified principal", async () => {
    const fake = fakeRepository();
    app = buildAppAs("PYME", { notification: deps(fake.repository) });

    await app.inject({
      method: "POST",
      url: "/notifications/read-all",
      payload: { recipientUserId: OTHER_ID }
    });

    expect(fake.markAllCalls).toEqual([CALLER_ID]);
    expect(fake.markAllCalls).not.toContain(OTHER_ID);
  });

  it("answers 503 instead of a zero 200 when the repository is unavailable", async () => {
    const fake = fakeRepository({ markAllRead: async () => ({ ok: false, code: "unavailable" }) });
    app = buildAppAs("PYME", { notification: deps(fake.repository) });

    const response = await app.inject({ method: "POST", url: "/notifications/read-all", payload: {} });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });
});
