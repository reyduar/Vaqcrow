import type { MarketplaceListResult, MarketplacePort } from "@/application/ports/marketplace-port";

/**
 * Null-object marketplace port used when no backend base URL is configured
 * (#480): every read answers `not_configured` — the honest "no API wired up",
 * which the page renders as a calm notice, **not** as a service failure and
 * never as an invented empty list.
 */
export const UNAVAILABLE_MARKETPLACE_PORT: MarketplacePort = Object.freeze({
  async list(): Promise<MarketplaceListResult> {
    return { ok: false, code: "not_configured" };
  }
});
