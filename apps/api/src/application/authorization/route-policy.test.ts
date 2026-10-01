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
      expect(key).toMatch(/^(GET|POST) \//);
    }
  });
});
