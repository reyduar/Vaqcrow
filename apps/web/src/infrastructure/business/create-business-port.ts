import type { BusinessPort } from "@/application/ports/business-port";
import { createBrowserAuthSession } from "@/infrastructure/auth/browser-auth-session";
import { createLazyAuthSession } from "@/infrastructure/auth/lazy-auth-session";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";
import { HttpBusinessGateway } from "./http-business-gateway";
import { UNAVAILABLE_BUSINESS_PORT } from "./unavailable-business-port";

export { UNAVAILABLE_BUSINESS_PORT };

/**
 * Builds the company port from the API base URL and, when given, the session's
 * access token. `null` when no backend is configured: the wizard then runs on
 * `UNAVAILABLE_BUSINESS_PORT` and refuses to submit.
 */
export function createBusinessPort(
  baseUrl: string | undefined,
  accessToken?: AccessTokenProvider
): BusinessPort | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return HttpBusinessGateway.create(trimmed, accessToken);
}

/**
 * The browser default used by the onboarding wizard. It reuses the app's
 * existing browser auth wiring to attach the session's `Authorization: Bearer`
 * token, following the same lazy-session approach as `createBrowserUploadPort`
 * (the session store does not expose `getAccessToken` to components today; a
 * later unit should share the single session port and drop this duplicate).
 */
export function createBrowserBusinessPort(): BusinessPort {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return UNAVAILABLE_BUSINESS_PORT;
  const session = createLazyAuthSession(createBrowserAuthSession);
  return HttpBusinessGateway.create(baseUrl, () => session.getAccessToken());
}
