import type { FavoritePort } from "@/application/ports/favorite-port";
import { createBrowserAuthSession } from "@/infrastructure/auth/browser-auth-session";
import { createLazyAuthSession } from "@/infrastructure/auth/lazy-auth-session";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";
import { HttpFavoriteGateway } from "./http-favorite-gateway";
import { UNAVAILABLE_FAVORITE_PORT } from "./unavailable-favorite-port";

export { UNAVAILABLE_FAVORITE_PORT };

/** Builds the favorites port from the API base URL and an optional token provider; `null` without a backend. */
export function createFavoritePort(baseUrl: string | undefined, accessToken?: AccessTokenProvider): FavoritePort | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return HttpFavoriteGateway.create(trimmed, accessToken);
}

/**
 * Browser default. It reuses the app's lazy browser session to attach the
 * `Authorization: Bearer` token; without a configured base URL it is the null
 * object so favorites stay honest.
 */
export function createBrowserFavoritePort(): FavoritePort {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return UNAVAILABLE_FAVORITE_PORT;
  const session = createLazyAuthSession(createBrowserAuthSession);
  return HttpFavoriteGateway.create(baseUrl, () => session.getAccessToken());
}
