import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBrowserMarketplacePort,
  createMarketplacePort,
  UNAVAILABLE_MARKETPLACE_PORT
} from "./create-marketplace-port";
import { HttpMarketplaceGateway } from "./http-marketplace-gateway";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createMarketplacePort", () => {
  it("returns null without a base URL", () => {
    expect(createMarketplacePort(undefined)).toBeNull();
    expect(createMarketplacePort("")).toBeNull();
    expect(createMarketplacePort("   ")).toBeNull();
  });

  it("builds the HTTP gateway from a trimmed base URL", () => {
    const port = createMarketplacePort("  http://localhost:3000  ");
    expect(port).toBeInstanceOf(HttpMarketplaceGateway);
  });
});

describe("createBrowserMarketplacePort", () => {
  it("falls back to the null object without a configured base URL", () => {
    expect(createBrowserMarketplacePort()).toBe(UNAVAILABLE_MARKETPLACE_PORT);
  });

  it("builds a gateway when the base URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:3000");
    const port = createBrowserMarketplacePort();
    expect(port).not.toBe(UNAVAILABLE_MARKETPLACE_PORT);
    expect(port).toBeInstanceOf(HttpMarketplaceGateway);
  });
});
