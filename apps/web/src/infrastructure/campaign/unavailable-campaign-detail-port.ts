import type { CampaignDetailResult, CampaignDetailPort } from "@/application/ports/campaign-detail-port";

/**
 * Null-object campaign-detail port used when no backend base URL is configured
 * (#480): every read answers `not_configured` — the honest "no API wired up",
 * which the page renders as a calm notice, **not** as a service failure and
 * never as an invented detail.
 */
export const UNAVAILABLE_CAMPAIGN_DETAIL_PORT: CampaignDetailPort = Object.freeze({
  async get(): Promise<CampaignDetailResult> {
    return { ok: false, code: "not_configured" };
  }
});
