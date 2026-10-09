import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBrowserCampaignDetailPort,
  createCampaignDetailPort,
  UNAVAILABLE_CAMPAIGN_DETAIL_PORT
} from "./create-campaign-detail-port";
import { HttpCampaignDetailGateway } from "./http-campaign-detail-gateway";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createCampaignDetailPort", () => {
  it("returns null without a base URL", () => {
    expect(createCampaignDetailPort(undefined)).toBeNull();
    expect(createCampaignDetailPort("")).toBeNull();
    expect(createCampaignDetailPort("   ")).toBeNull();
  });

  it("builds the HTTP gateway from a trimmed base URL", () => {
    const port = createCampaignDetailPort("  http://localhost:3000  ", async () => "token");
    expect(port).toBeInstanceOf(HttpCampaignDetailGateway);
  });
});

describe("createBrowserCampaignDetailPort", () => {
  it("falls back to the null object without a configured base URL", () => {
    expect(createBrowserCampaignDetailPort()).toBe(UNAVAILABLE_CAMPAIGN_DETAIL_PORT);
  });

  it("builds a gateway when the base URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:3000");
    const port = createBrowserCampaignDetailPort();
    expect(port).not.toBe(UNAVAILABLE_CAMPAIGN_DETAIL_PORT);
    expect(port).toBeInstanceOf(HttpCampaignDetailGateway);
  });
});
