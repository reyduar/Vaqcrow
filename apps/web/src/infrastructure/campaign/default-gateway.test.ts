import { describe, expect, it } from "vitest";
import { createCampaignGateway } from "./default-gateway";

describe("createCampaignGateway", () => {
  it("returns null when no backend is configured, so the UI can refuse explicitly", () => {
    expect(createCampaignGateway(undefined)).toBeNull();
    expect(createCampaignGateway("")).toBeNull();
    expect(createCampaignGateway("   ")).toBeNull();
  });

  it("returns a gateway when a base URL is configured", () => {
    expect(createCampaignGateway("http://localhost:3001")).not.toBeNull();
  });
});
