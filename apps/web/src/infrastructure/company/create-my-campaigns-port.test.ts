import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBrowserMyCampaignsPort,
  createMyCampaignsPort,
  UNAVAILABLE_MY_CAMPAIGNS_PORT
} from "./create-my-campaigns-port";
import { HttpMyCampaignsGateway } from "./http-my-campaigns-gateway";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createMyCampaignsPort", () => {
  it("returns null without a base URL", () => {
    expect(createMyCampaignsPort(undefined)).toBeNull();
    expect(createMyCampaignsPort("")).toBeNull();
    expect(createMyCampaignsPort("   ")).toBeNull();
  });

  it("builds the HTTP gateway from a trimmed base URL", () => {
    const port = createMyCampaignsPort("  http://localhost:3000  ");
    expect(port).toBeInstanceOf(HttpMyCampaignsGateway);
  });
});

describe("createBrowserMyCampaignsPort", () => {
  it("falls back to the null object without a configured base URL", () => {
    expect(createBrowserMyCampaignsPort()).toBe(UNAVAILABLE_MY_CAMPAIGNS_PORT);
  });

  it("builds a gateway when the base URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:3000");
    const port = createBrowserMyCampaignsPort();
    expect(port).not.toBe(UNAVAILABLE_MY_CAMPAIGNS_PORT);
    expect(port).toBeInstanceOf(HttpMyCampaignsGateway);
  });
});

describe("UNAVAILABLE_MY_CAMPAIGNS_PORT", () => {
  it("always answers the sanitized unavailable", async () => {
    expect(await UNAVAILABLE_MY_CAMPAIGNS_PORT.get()).toEqual({ ok: false, code: "unavailable" });
  });
});
