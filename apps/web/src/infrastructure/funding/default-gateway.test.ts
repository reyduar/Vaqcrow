import { describe, expect, it } from "vitest";
import { createFundingIntentGateway } from "./default-gateway";

describe("createFundingIntentGateway", () => {
  it("returns null when no backend is configured, so the UI can refuse explicitly", () => {
    expect(createFundingIntentGateway(undefined)).toBeNull();
    expect(createFundingIntentGateway("")).toBeNull();
    expect(createFundingIntentGateway("   ")).toBeNull();
  });

  it("returns a gateway when a base URL is configured", () => {
    expect(createFundingIntentGateway("http://localhost:3001")).not.toBeNull();
  });
});
