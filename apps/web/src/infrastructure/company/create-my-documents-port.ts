import type { MyDocumentsPort } from "@/application/ports/my-documents-port";
import { createBrowserAuthSession } from "@/infrastructure/auth/browser-auth-session";
import { createLazyAuthSession } from "@/infrastructure/auth/lazy-auth-session";
import { type AccessTokenProvider, AxiosHttpClient } from "@/infrastructure/http/axios-http-client";
import { HttpMyDocumentsGateway } from "./http-my-documents-gateway";

/**
 * Builds the owner-scoped documents port from the API base URL and the
 * session's access token. `null` when no backend is configured, so a missing
 * read stays "unknown" and never a service failure (#480); the endpoint is
 * `PYME`-only and owner-scoped by the API from that same token.
 */
export function createMyDocumentsPort(
  baseUrl: string | undefined,
  accessToken?: AccessTokenProvider
): MyDocumentsPort | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  // `exactOptionalPropertyTypes` forbids an explicit `undefined` token, so the
  // option is added only when present.
  const client = AxiosHttpClient.create(
    accessToken === undefined ? { baseUrl: trimmed } : { baseUrl: trimmed, accessToken }
  );
  return new HttpMyDocumentsGateway(client);
}

/**
 * The browser default used by the «Ver lo enviado» panel. It follows the same
 * lazy-session approach as `createBrowserSmeRequestGateway` (the session store
 * does not expose `getAccessToken` to components today); build it per mount,
 * never at module scope. `null` without a base URL: the panel then degrades to
 * an honest per-block message instead of inventing an empty document list.
 */
export function createBrowserMyDocumentsPort(): MyDocumentsPort | null {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return null;
  const session = createLazyAuthSession(createBrowserAuthSession);
  return createMyDocumentsPort(baseUrl, () => session.getAccessToken());
}
