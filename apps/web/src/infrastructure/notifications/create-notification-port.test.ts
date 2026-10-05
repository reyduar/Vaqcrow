import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserNotificationPort, createNotificationPort, UNAVAILABLE_NOTIFICATION_PORT } from "./create-notification-port";
import { HttpNotificationGateway } from "./http-notification-gateway";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createNotificationPort", () => {
  it("returns null for a missing or blank base URL", () => {
    expect(createNotificationPort(undefined)).toBeNull();
    expect(createNotificationPort("")).toBeNull();
    expect(createNotificationPort("   ")).toBeNull();
  });

  it("builds the HTTP gateway when a base URL is configured", () => {
    expect(createNotificationPort("https://api.test")).toBeInstanceOf(HttpNotificationGateway);
  });
});

describe("UNAVAILABLE_NOTIFICATION_PORT", () => {
  it("answers a sanitized unavailable code on every call", async () => {
    expect(await UNAVAILABLE_NOTIFICATION_PORT.list()).toEqual({ ok: false, code: "unavailable" });
    expect(await UNAVAILABLE_NOTIFICATION_PORT.countUnread()).toEqual({ ok: false, code: "unavailable" });
    expect(await UNAVAILABLE_NOTIFICATION_PORT.markRead("n-1")).toEqual({ ok: false, code: "unavailable" });
    expect(await UNAVAILABLE_NOTIFICATION_PORT.markAllRead()).toEqual({ ok: false, code: "unavailable" });
  });
});

describe("createBrowserNotificationPort", () => {
  it("returns the null-object when no base URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    expect(createBrowserNotificationPort()).toBe(UNAVAILABLE_NOTIFICATION_PORT);
  });

  it("builds the HTTP gateway when the base URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.test");
    expect(createBrowserNotificationPort()).toBeInstanceOf(HttpNotificationGateway);
  });
});
