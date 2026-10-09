import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBrowserPortfolioPort,
  createPortfolioPort,
  UNAVAILABLE_PORTFOLIO_PORT
} from "./create-portfolio-port";
import { HttpPortfolioGateway } from "./http-portfolio-gateway";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createPortfolioPort", () => {
  it("returns null without a base URL", () => {
    expect(createPortfolioPort(undefined)).toBeNull();
    expect(createPortfolioPort("")).toBeNull();
    expect(createPortfolioPort("   ")).toBeNull();
  });

  it("builds the HTTP gateway from a trimmed base URL", () => {
    const port = createPortfolioPort("  http://localhost:3000  ");
    expect(port).toBeInstanceOf(HttpPortfolioGateway);
  });
});

describe("createBrowserPortfolioPort", () => {
  it("falls back to the null object without a configured base URL", () => {
    expect(createBrowserPortfolioPort()).toBe(UNAVAILABLE_PORTFOLIO_PORT);
  });

  it("builds a gateway when the base URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:3000");
    const port = createBrowserPortfolioPort();
    expect(port).not.toBe(UNAVAILABLE_PORTFOLIO_PORT);
    expect(port).toBeInstanceOf(HttpPortfolioGateway);
  });
});
