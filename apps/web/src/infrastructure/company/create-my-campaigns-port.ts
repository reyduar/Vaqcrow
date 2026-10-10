import type { MyCampaignsPort } from "@/application/ports/my-campaigns-port";
import { createBrowserAuthSession } from "@/infrastructure/auth/browser-auth-session";
import { createLazyAuthSession } from "@/infrastructure/auth/lazy-auth-session";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";
import { HttpMyCampaignsGateway } from "./http-my-campaigns-gateway";
import { UNAVAILABLE_MY_CAMPAIGNS_PORT } from "./unavailable-my-campaigns-port";

export { UNAVAILABLE_MY_CAMPAIGNS_PORT };

/** Builds the dashboard port from the API base URL; `null` without a backend. */
export function createMyCampaignsPort(
  baseUrl: string | undefined,
  accessToken?: AccessTokenProvider
): MyCampaignsPort | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return HttpMyCampaignsGateway.create(trimmed, accessToken);
}

/**
 * Browser default. The dashboard is `PYME`-only, so it reuses the app's lazy
 * browser session to attach the `Authorization: Bearer` token; without a
 * configured base URL it is the null object so the page stays honest.
 */
export function createBrowserMyCampaignsPort(): MyCampaignsPort {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return UNAVAILABLE_MY_CAMPAIGNS_PORT;
  const session = createLazyAuthSession(createBrowserAuthSession);
  return HttpMyCampaignsGateway.create(baseUrl, () => session.getAccessToken());
}
