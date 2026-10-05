import type { AxiosInstance } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpNotificationGateway } from "./http-notification-gateway";

const ITEM = {
  id: "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10",
  recipientUserId: "00000000-0000-4000-8000-000000000000",
  eventKey: "contribution:1",
  eventType: "investor.contribution_confirmed",
  title: "Tu aporte se confirmó",
  body: "Tu aporte quedó registrado en Stellar Testnet.",
  ctaLabel: "Ver mi portafolio",
  ctaHref: "/portfolio",
  readAt: null,
  createdAt: "2026-10-04T09:42:00.000Z"
};

interface Call {
  readonly method: "get" | "post";
  readonly url: string;
  readonly data: unknown;
  readonly config: Record<string, unknown> | undefined;
}

type Response = { status: number; data: unknown } | Error;

function fakeClient(fake: { get?: Response; post?: Response } = {}) {
  const calls: Call[] = [];
  const client = {
    get: async (url: string, config: Record<string, unknown> | undefined) => {
      calls.push({ method: "get", url, data: undefined, config });
      if (fake.get instanceof Error) throw fake.get;
      return fake.get ?? { status: 200, data: { notifications: [ITEM] } };
    },
    post: async (url: string, data: unknown, config: Record<string, unknown> | undefined) => {
      calls.push({ method: "post", url, data, config });
      if (fake.post instanceof Error) throw fake.post;
      return fake.post ?? { status: 200, data: { read: true } };
    }
  } as unknown as AxiosInstance;
  return { client, calls };
}

afterEach(() => vi.restoreAllMocks());

describe("HttpNotificationGateway.list", () => {
  it("reads the notifications with the Bearer token", async () => {
    const { client, calls } = fakeClient();
    const gateway = new HttpNotificationGateway(client, async () => "token-123");

    expect(await gateway.list()).toEqual({ ok: true, notifications: [ITEM] });
    expect(calls[0]!.method).toBe("get");
    expect(calls[0]!.url).toBe("/notifications");
    expect(calls[0]!.config?.["headers"]).toEqual({ Authorization: "Bearer token-123" });
  });

  it("sends no Authorization header without a token", async () => {
    const { client, calls } = fakeClient();
    await new HttpNotificationGateway(client, async () => null).list();
    expect(calls[0]!.config?.["headers"]).toEqual({});
  });

  it("maps a status to a sanitized code and a malformed body to unavailable", async () => {
    const unauthorized = fakeClient({ get: { status: 401, data: { code: "unauthenticated" } } });
    expect(await new HttpNotificationGateway(unauthorized.client).list()).toEqual({ ok: false, code: "unavailable" });

    const malformed = fakeClient({ get: { status: 200, data: { notifications: [{ id: "x" }] } } });
    expect(await new HttpNotificationGateway(malformed.client).list()).toEqual({ ok: false, code: "unavailable" });
  });

  it("answers network when the transport throws", async () => {
    const { client } = fakeClient({ get: new Error("offline") });
    expect(await new HttpNotificationGateway(client).list()).toEqual({ ok: false, code: "network" });
  });
});

describe("HttpNotificationGateway.countUnread", () => {
  it("reads the unread count", async () => {
    const { client, calls } = fakeClient({ get: { status: 200, data: { unread: 3 } } });

    expect(await new HttpNotificationGateway(client).countUnread()).toEqual({ ok: true, unread: 3 });
    expect(calls[0]!.url).toBe("/notifications/unread-count");
  });

  it("answers unavailable for a negative or non-integer count", async () => {
    const { client } = fakeClient({ get: { status: 200, data: { unread: -1 } } });
    expect(await new HttpNotificationGateway(client).countUnread()).toEqual({ ok: false, code: "unavailable" });
  });
});

describe("HttpNotificationGateway.markRead", () => {
  it("posts to the read route and reads 404 as not_found", async () => {
    const ok = fakeClient();
    const gateway = new HttpNotificationGateway(ok.client);
    expect(await gateway.markRead("n-1")).toEqual({ ok: true });
    expect(ok.calls[0]!.method).toBe("post");
    expect(ok.calls[0]!.url).toBe("/notifications/n-1/read");

    const missing = fakeClient({ post: { status: 404, data: { error: "not_found" } } });
    expect(await new HttpNotificationGateway(missing.client).markRead("n-1")).toEqual({
      ok: false,
      code: "not_found"
    });
  });

  it("answers network when the transport throws", async () => {
    const { client } = fakeClient({ post: new Error("socket hang up") });
    expect(await new HttpNotificationGateway(client).markRead("n-1")).toEqual({ ok: false, code: "network" });
  });
});

describe("HttpNotificationGateway.markAllRead", () => {
  it("posts to the read-all route and returns the updated count", async () => {
    const { client, calls } = fakeClient({ post: { status: 200, data: { updated: 2 } } });

    expect(await new HttpNotificationGateway(client).markAllRead()).toEqual({ ok: true, updated: 2 });
    expect(calls[0]!.method).toBe("post");
    expect(calls[0]!.url).toBe("/notifications/read-all");
  });

  it("answers unavailable for a malformed body", async () => {
    const { client } = fakeClient({ post: { status: 200, data: {} } });
    expect(await new HttpNotificationGateway(client).markAllRead()).toEqual({ ok: false, code: "unavailable" });
  });
});
