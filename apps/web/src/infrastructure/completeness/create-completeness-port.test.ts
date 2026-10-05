import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBrowserCompletenessPort,
  createCompletenessPort,
  UNAVAILABLE_COMPLETENESS_PORT
} from "./create-completeness-port";
import { HttpCompletenessGateway } from "./http-completeness-gateway";

const INPUT = {
  documents: [],
  photoCount: 0,
  salesMonths: []
} as const;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createCompletenessPort", () => {
  it("returns null for a missing or blank base URL", () => {
    expect(createCompletenessPort(undefined)).toBeNull();
    expect(createCompletenessPort("")).toBeNull();
    expect(createCompletenessPort("   ")).toBeNull();
  });

  it("builds the HTTP gateway when a base URL is configured", () => {
    expect(createCompletenessPort("https://api.test")).toBeInstanceOf(HttpCompletenessGateway);
  });
});

describe("UNAVAILABLE_COMPLETENESS_PORT", () => {
  it("answers a sanitized unavailable code", async () => {
    expect(await UNAVAILABLE_COMPLETENESS_PORT.check(INPUT)).toEqual({ ok: false, code: "unavailable" });
  });
});

describe("createBrowserCompletenessPort", () => {
  it("returns the null-object when no base URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    expect(createBrowserCompletenessPort()).toBe(UNAVAILABLE_COMPLETENESS_PORT);
  });

  it("builds the HTTP gateway when the base URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.test");
    expect(createBrowserCompletenessPort()).toBeInstanceOf(HttpCompletenessGateway);
  });
});
