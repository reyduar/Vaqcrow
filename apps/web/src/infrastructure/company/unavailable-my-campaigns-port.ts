import type { MyCampaignsPort, MyCampaignsResult } from "@/application/ports/my-campaigns-port";

/**
 * Null-object `MyCampaignsPort` used when no backend base URL is configured:
 * every read is the sanitized `unavailable`, so the page shows its error state
 * instead of an invented empty dashboard.
 */
export const UNAVAILABLE_MY_CAMPAIGNS_PORT: MyCampaignsPort = Object.freeze({
  async get(): Promise<MyCampaignsResult> {
    return { ok: false, code: "unavailable" };
  }
});
