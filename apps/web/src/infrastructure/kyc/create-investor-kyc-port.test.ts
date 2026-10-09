import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserInvestorKycPort, createInvestorKycPort, UNAVAILABLE_INVESTOR_KYC_PORT } from "./create-investor-kyc-port";
import { HttpInvestorKycGateway } from "./http-investor-kyc-gateway";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createInvestorKycPort", () => {
  it("returns null without a base URL", () => {
    expect(createInvestorKycPort(undefined)).toBeNull();
    expect(createInvestorKycPort("")).toBeNull();
    expect(createInvestorKycPort("   ")).toBeNull();
  });

  it("builds the HTTP gateway from a trimmed base URL", () => {
    const port = createInvestorKycPort("  http://localhost:3000  ", async () => "token");
    expect(port).toBeInstanceOf(HttpInvestorKycGateway);
  });
});

describe("createBrowserInvestorKycPort", () => {
  it("falls back to the null object without a configured base URL", () => {
    expect(createBrowserInvestorKycPort()).toBe(UNAVAILABLE_INVESTOR_KYC_PORT);
  });

  it("builds a gateway when the base URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:3000");
    const port = createBrowserInvestorKycPort();
    expect(port).not.toBe(UNAVAILABLE_INVESTOR_KYC_PORT);
    expect(port).toBeInstanceOf(HttpInvestorKycGateway);
  });
});
