import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserFavoritePort, createFavoritePort, UNAVAILABLE_FAVORITE_PORT } from "./create-favorite-port";
import { HttpFavoriteGateway } from "./http-favorite-gateway";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createFavoritePort", () => {
  it("returns null without a base URL", () => {
    expect(createFavoritePort(undefined)).toBeNull();
    expect(createFavoritePort("")).toBeNull();
    expect(createFavoritePort("   ")).toBeNull();
  });

  it("builds the HTTP gateway from a trimmed base URL", () => {
    const port = createFavoritePort("  http://localhost:3000  ", async () => "token");
    expect(port).toBeInstanceOf(HttpFavoriteGateway);
  });
});

describe("createBrowserFavoritePort", () => {
  it("falls back to the null object without a configured base URL", () => {
    expect(createBrowserFavoritePort()).toBe(UNAVAILABLE_FAVORITE_PORT);
  });

  it("builds a gateway when the base URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:3000");
    const port = createBrowserFavoritePort();
    expect(port).not.toBe(UNAVAILABLE_FAVORITE_PORT);
    expect(port).toBeInstanceOf(HttpFavoriteGateway);
  });
});
