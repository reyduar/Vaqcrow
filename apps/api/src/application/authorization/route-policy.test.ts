import { describe, expect, it } from "vitest";
import { resolveRoutePolicy, ROUTE_POLICY_KEYS } from "./route-policy.js";

describe("resolveRoutePolicy", () => {
  it("returns undefined for a route with no entry (the caller must deny)", () => {
    expect(resolveRoutePolicy("GET", "/not-listed")).toBeUndefined();
  });

  it("treats HEAD like GET", () => {
    expect(resolveRoutePolicy("HEAD", "/health")).toEqual({ kind: "public" });
  });

  it("lists every policy key as METHOD + pattern", () => {
    for (const key of ROUTE_POLICY_KEYS) {
      expect(key).toMatch(/^(GET|POST|DELETE) \//);
    }
  });

  it("lists the notification routes as authenticated for every role", () => {
    const routes = [
      "GET /notifications",
      "GET /notifications/unread-count",
      "POST /notifications/:notificationId/read",
      "POST /notifications/read-all"
    ] as const;

    for (const key of routes) {
      expect(ROUTE_POLICY_KEYS).toContain(key);
    }
    for (const key of routes) {
      const [method, pattern] = key.split(" ") as [string, string];
      expect(resolveRoutePolicy(method, pattern)).toEqual({ kind: "authenticated" });
    }
  });
});
