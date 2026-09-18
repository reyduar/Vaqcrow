import { describe, expect, it } from "vitest";
import { createSmeRequestGateway } from "./default-gateway";

describe("createSmeRequestGateway", () => {
  it("returns null when no backend base URL is configured, so the demo runs on fixtures", () => {
    expect(createSmeRequestGateway(undefined)).toBeNull();
    expect(createSmeRequestGateway("")).toBeNull();
    expect(createSmeRequestGateway("   ")).toBeNull();
  });

  it("returns a gateway when a base URL is configured", () => {
    expect(createSmeRequestGateway("https://api.example.test")).not.toBeNull();
  });
});
