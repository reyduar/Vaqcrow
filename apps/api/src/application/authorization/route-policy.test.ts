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
      expect(key).toMatch(/^(GET|POST|PUT|DELETE) \//);
    }
  });

  it("restricts the completeness check to PYME", () => {
    expect(resolveRoutePolicy("POST", "/completeness-check")).toEqual({
      kind: "roles",
      roles: ["PYME"]
    });
  });

  it("restricts the per-application Testnet evidence chain to ADMIN (#438/WU2)", () => {
    expect(resolveRoutePolicy("GET", "/application-reviews/:applicationId/evidence")).toEqual({
      kind: "roles",
      roles: ["ADMIN"]
    });
    expect(resolveRoutePolicy("HEAD", "/application-reviews/:applicationId/evidence")).toEqual({
      kind: "roles",
      roles: ["ADMIN"]
    });
  });

  it("lists the public marketplace listing and campaign image as public (#414/WU1/WU3)", () => {
    expect(resolveRoutePolicy("GET", "/marketplace/campaigns")).toEqual({ kind: "public" });
    expect(resolveRoutePolicy("HEAD", "/marketplace/campaigns")).toEqual({ kind: "public" });
    expect(resolveRoutePolicy("GET", "/marketplace/campaigns/:campaignId/image")).toEqual({ kind: "public" });
    expect(resolveRoutePolicy("HEAD", "/marketplace/campaigns/:campaignId/image")).toEqual({ kind: "public" });
  });

  it("lists the public blog routes as public (#498/WU2)", () => {
    expect(resolveRoutePolicy("GET", "/blog")).toEqual({ kind: "public" });
    expect(resolveRoutePolicy("HEAD", "/blog")).toEqual({ kind: "public" });
    expect(resolveRoutePolicy("GET", "/blog/:slug")).toEqual({ kind: "public" });
    expect(resolveRoutePolicy("HEAD", "/blog/:slug")).toEqual({ kind: "public" });
  });

  it("restricts the help assistant to PYME and INVERSOR (#499/WU2, D7)", () => {
    expect(resolveRoutePolicy("POST", "/assistant/questions")).toEqual({
      kind: "roles",
      roles: ["PYME", "INVERSOR"]
    });
  });

  it("restricts the assistant access toggle to ADMIN (#499/WU2, D9)", () => {
    expect(resolveRoutePolicy("POST", "/admin/users/:userId/chat-access")).toEqual({
      kind: "roles",
      roles: ["ADMIN"]
    });
  });

  it("restricts the company post-submission reads to PYME (#530/T1/T2)", () => {
    expect(resolveRoutePolicy("GET", "/sme-requests/mine")).toEqual({ kind: "roles", roles: ["PYME"] });
    expect(resolveRoutePolicy("HEAD", "/sme-requests/mine")).toEqual({ kind: "roles", roles: ["PYME"] });
    expect(resolveRoutePolicy("GET", "/pyme-documents/mine")).toEqual({ kind: "roles", roles: ["PYME"] });
    expect(resolveRoutePolicy("HEAD", "/pyme-documents/mine")).toEqual({ kind: "roles", roles: ["PYME"] });
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

  it("lists the favorites routes as authenticated for every role (#414/WU2)", () => {
    const routes = [
      "GET /favorites",
      "PUT /favorites/:campaignId",
      "DELETE /favorites/:campaignId"
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
