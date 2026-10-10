import type { CampaignDetailPort } from "@/application/ports/campaign-detail-port";
import { createBrowserAuthSession } from "@/infrastructure/auth/browser-auth-session";
import { createLazyAuthSession } from "@/infrastructure/auth/lazy-auth-session";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";
import { HttpCampaignDetailGateway } from "./http-campaign-detail-gateway";
import { UNAVAILABLE_CAMPAIGN_DETAIL_PORT } from "./unavailable-campaign-detail-port";

export { UNAVAILABLE_CAMPAIGN_DETAIL_PORT };

/**
 * Builds the campaign-detail port from the API base URL and an optional token
 * provider; `null` without a backend.
 */
export function createCampaignDetailPort(
  baseUrl: string | undefined,
  accessToken?: AccessTokenProvider
): CampaignDetailPort | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return HttpCampaignDetailGateway.create(trimmed, accessToken);
}

/**
 * Browser default. The detail is account-gated, so it reuses the app's lazy
 * browser session to attach the `Authorization: Bearer` token; without a
 * configured base URL it is the null object so the page stays honest.
 */
export function createBrowserCampaignDetailPort(): CampaignDetailPort {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return UNAVAILABLE_CAMPAIGN_DETAIL_PORT;
  const session = createLazyAuthSession(createBrowserAuthSession);
  return HttpCampaignDetailGateway.create(baseUrl, () => session.getAccessToken());
}
