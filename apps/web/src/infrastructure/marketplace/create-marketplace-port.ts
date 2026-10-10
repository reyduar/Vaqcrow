import type { MarketplacePort } from "@/application/ports/marketplace-port";
import { HttpMarketplaceGateway } from "./http-marketplace-gateway";
import { UNAVAILABLE_MARKETPLACE_PORT } from "./unavailable-marketplace-port";

export { UNAVAILABLE_MARKETPLACE_PORT };

/** Builds the marketplace port from the API base URL; `null` without a backend. */
export function createMarketplacePort(baseUrl: string | undefined): MarketplacePort | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return HttpMarketplaceGateway.create(trimmed);
}

/**
 * Browser default. The route is public, so no auth token is attached; without a
 * configured base URL it is the null object so the page stays honest.
 */
export function createBrowserMarketplacePort(): MarketplacePort {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return UNAVAILABLE_MARKETPLACE_PORT;
  return HttpMarketplaceGateway.create(baseUrl);
}
