import type { SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import { createBrowserAuthSession } from "@/infrastructure/auth/browser-auth-session";
import { createLazyAuthSession } from "@/infrastructure/auth/lazy-auth-session";
import { type AccessTokenProvider, AxiosHttpClient } from "@/infrastructure/http/axios-http-client";
import { HttpSmeRequestGateway } from "./http-sme-request-gateway";

/**
 * Builds the SME-request gateway from the API base URL and, when given, the
 * session's access token. `null` when no backend is configured: callers then
 * run on synthetic fixtures only. Without a provider no `Authorization` header
 * is sent (the legacy scripted journey).
 */
export function createSmeRequestGateway(
  baseUrl: string | undefined,
  accessToken?: AccessTokenProvider
): SmeRequestGateway | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return new HttpSmeRequestGateway(
    AxiosHttpClient.create({ baseUrl: trimmed, ...(accessToken ? { accessToken } : {}) })
  );
}

/**
 * The browser default used by the onboarding wizard. `POST /sme-requests` is
 * `PYME`-only in the API, so the send must carry the signed-in session's
 * `Authorization: Bearer` token. It follows the same lazy-session approach as
 * `createBrowserBusinessPort` and `createBrowserUploadPort` (the session store
 * does not expose `getAccessToken` to components today); build it per mount,
 * never at module scope.
 */
export function createBrowserSmeRequestGateway(): SmeRequestGateway | null {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return null;
  const session = createLazyAuthSession(createBrowserAuthSession);
  return createSmeRequestGateway(baseUrl, () => session.getAccessToken());
}
