import type { CompletenessCheckPort } from "@/application/ports/completeness-check-port";
import { createBrowserAuthSession } from "@/infrastructure/auth/browser-auth-session";
import { createLazyAuthSession } from "@/infrastructure/auth/lazy-auth-session";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";
import { HttpCompletenessGateway } from "./http-completeness-gateway";
import { UNAVAILABLE_COMPLETENESS_PORT } from "./unavailable-completeness-port";

export { UNAVAILABLE_COMPLETENESS_PORT };

/**
 * Builds the completeness port from the API base URL and, when given, the
 * session's access token. `null` when no backend is configured: the wizard then
 * runs on `UNAVAILABLE_COMPLETENESS_PORT` and step 3 says the check is
 * unavailable instead of acting.
 */
export function createCompletenessPort(
  baseUrl: string | undefined,
  accessToken?: AccessTokenProvider
): CompletenessCheckPort | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return HttpCompletenessGateway.create(trimmed, accessToken);
}

/**
 * The browser default used by the onboarding wizard. It reuses the app's
 * existing browser auth wiring to attach the session's `Authorization: Bearer`
 * token, following the same lazy-session approach as `createBrowserBusinessPort`
 * (the session store does not expose `getAccessToken` to components today; a
 * later unit should share the single session port and drop this duplicate).
 */
export function createBrowserCompletenessPort(): CompletenessCheckPort {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return UNAVAILABLE_COMPLETENESS_PORT;
  const session = createLazyAuthSession(createBrowserAuthSession);
  return HttpCompletenessGateway.create(baseUrl, () => session.getAccessToken());
}
