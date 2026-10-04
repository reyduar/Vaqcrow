import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserBusinessPort, createBusinessPort, UNAVAILABLE_BUSINESS_PORT } from "./create-business-port";
import { HttpBusinessGateway } from "./http-business-gateway";

const DRAFT = {
  name: "Panadería Horizonte SRL",
  cuit: "30712345678",
  sector: "Alimentos",
  city: "Córdoba",
  description: "Pan de masa madre y facturas para barrio y 22 cafeterías.",
  goalArs: 15000000,
  revenueShare: 4.5
} as const;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createBusinessPort", () => {
  it("returns null for a missing or blank base URL", () => {
    expect(createBusinessPort(undefined)).toBeNull();
    expect(createBusinessPort("")).toBeNull();
    expect(createBusinessPort("   ")).toBeNull();
  });

  it("builds the HTTP gateway when a base URL is configured", () => {
    expect(createBusinessPort("https://api.test")).toBeInstanceOf(HttpBusinessGateway);
  });
});

describe("UNAVAILABLE_BUSINESS_PORT", () => {
  it("answers a sanitized unavailable code for create and read", async () => {
    expect(await UNAVAILABLE_BUSINESS_PORT.createBusiness(DRAFT)).toEqual({ ok: false, code: "unavailable" });
    expect(await UNAVAILABLE_BUSINESS_PORT.getMyBusiness()).toEqual({ ok: false, code: "unavailable" });
  });
});

describe("createBrowserBusinessPort", () => {
  it("returns the null-object when no base URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    expect(createBrowserBusinessPort()).toBe(UNAVAILABLE_BUSINESS_PORT);
  });

  it("builds the HTTP gateway when the base URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.test");
    expect(createBrowserBusinessPort()).toBeInstanceOf(HttpBusinessGateway);
  });
});
