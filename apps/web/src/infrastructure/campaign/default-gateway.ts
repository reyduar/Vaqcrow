import type { CampaignGateway } from "@/application/ports/campaign-gateway";
import { createBrowserAuthSession } from "@/infrastructure/auth/browser-auth-session";
import { createLazyAuthSession } from "@/infrastructure/auth/lazy-auth-session";
import { type AccessTokenProvider, AxiosHttpClient } from "@/infrastructure/http/axios-http-client";
import { HttpCampaignGateway } from "./http-campaign-gateway";

/**
 * Builds the campaign gateway from the API base URL and the session's access
 * token. `null` when no backend is configured.
 *
 * Every route this gateway serves (`GET /campaigns/:id`, the invocation
 * prepare/submit and the transaction poll) is `AUTHENTICATED` in the API, so the
 * request must carry the signed-in session's `Authorization: Bearer` token. The
 * token is resolved **per request** through a single lazy session, exactly like
 * `createBrowserSmeRequestGateway`: the factory is never called at import time,
 * so `createCampaignGateway(baseUrl)` stays safe at module scope in a component
 * that renders before any session exists. `accessToken` is a test seam;
 * production omits it and the browser session is used.
 */
/**
 * The vault calls this gateway drives — the `invocations` prepare/submit and the
 * transaction poll — touch Soroban RPC, so they routinely take longer than the
 * HTTP client's default 10s. The live rehearsal aborted the prepare at exactly
 * 10s (`net::ERR_ABORTED` right at the timeout), so a chain round-trip plus the
 * API's own work needs more headroom than the generic default.
 */
const CHAIN_REQUEST_TIMEOUT_MS = 60_000;

export function createCampaignGateway(
  baseUrl: string | undefined,
  accessToken?: AccessTokenProvider
): CampaignGateway | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  const provider = accessToken ?? createBrowserAccessTokenProvider();
  return new HttpCampaignGateway(
    AxiosHttpClient.create({ baseUrl: trimmed, accessToken: provider, timeoutMs: CHAIN_REQUEST_TIMEOUT_MS })
  );
}

/** A single lazy browser session, evaluated on the first request, never at import time. */
function createBrowserAccessTokenProvider(): AccessTokenProvider {
  const session = createLazyAuthSession(createBrowserAuthSession);
  return () => session.getAccessToken();
}
