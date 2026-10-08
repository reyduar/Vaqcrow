import type { MarketplaceListResult, MarketplacePort } from "@/application/ports/marketplace-port";

/**
 * Null-object marketplace port used when no backend base URL is configured:
 * every read is the sanitized `unavailable`, so the page shows its error state
 * instead of an invented empty list.
 */
export const UNAVAILABLE_MARKETPLACE_PORT: MarketplacePort = Object.freeze({
  async list(): Promise<MarketplaceListResult> {
    return { ok: false, code: "unavailable" };
  }
});
