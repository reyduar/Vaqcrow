import type { PortfolioPort, PortfolioResult } from "@/application/ports/portfolio-port";

/**
 * Null-object portfolio port used when no backend base URL is configured: every
 * read is the sanitized `unavailable`, so the page shows its error state instead
 * of an invented empty portfolio.
 */
export const UNAVAILABLE_PORTFOLIO_PORT: PortfolioPort = Object.freeze({
  async get(): Promise<PortfolioResult> {
    return { ok: false, code: "unavailable" };
  }
});
