import type { MyCampaignsPort, MyCampaignsResult } from "@/application/ports/my-campaigns-port";

/**
 * Null-object `MyCampaignsPort` used when no backend base URL is configured
 * (#480): every read answers `not_configured` — the honest "no API wired up",
 * which the page renders as a calm notice, **not** as a service failure and
 * never as an invented empty dashboard.
 */
export const UNAVAILABLE_MY_CAMPAIGNS_PORT: MyCampaignsPort = Object.freeze({
  async get(): Promise<MyCampaignsResult> {
    return { ok: false, code: "not_configured" };
  }
});
