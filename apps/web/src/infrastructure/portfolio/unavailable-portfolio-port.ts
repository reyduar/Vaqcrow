import type { PortfolioPort, PortfolioResult } from "@/application/ports/portfolio-port";

/**
 * Null-object portfolio port used when no backend base URL is configured
 * (#480): every read answers `not_configured` — the honest "no API wired up",
 * which the page renders as a calm notice, **not** as a service failure and
 * never as an invented empty portfolio.
 */
export const UNAVAILABLE_PORTFOLIO_PORT: PortfolioPort = Object.freeze({
  async get(): Promise<PortfolioResult> {
    return { ok: false, code: "not_configured" };
  }
});
