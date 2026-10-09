import type { CampaignDetailResult, CampaignDetailPort } from "@/application/ports/campaign-detail-port";

/**
 * Null-object campaign-detail port used when no backend base URL is configured:
 * every read is the sanitized `unavailable`, so the page shows its error state
 * instead of an invented detail.
 */
export const UNAVAILABLE_CAMPAIGN_DETAIL_PORT: CampaignDetailPort = Object.freeze({
  async get(): Promise<CampaignDetailResult> {
    return { ok: false, code: "unavailable" };
  }
});
