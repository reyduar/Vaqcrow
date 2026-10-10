import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";

/**
 * Shared HTTP plumbing for the investor report adapters (Feature #430, WU2):
 * the bearer header, the API-relative image resolver and the range query. Kept
 * in one module so the report and sales gateways cannot drift apart.
 */

/** RFC 6750 `b64token` characters: anything else (spaces, CR/LF) is never put in a header. */
const BEARER_TOKEN_PATTERN = /^[A-Za-z0-9\-._~+/]+=*$/;

export async function bearerHeaders(
  provider: AccessTokenProvider | undefined
): Promise<Record<string, string> | undefined> {
  if (!provider) return undefined;
  let token: string | null;
  try {
    token = await provider();
  } catch {
    // No token is not a transport failure: the request goes out unauthenticated
    // and the API answers 401, which is mapped to `unauthenticated`.
    return undefined;
  }
  return typeof token === "string" && BEARER_TOKEN_PATTERN.test(token) ? { Authorization: `Bearer ${token}` } : undefined;
}

/** Resolves the contract's API-relative image path to an absolute URL; anything unresolvable is `null`. */
export function resolveImageSrc(imageUrl: string | null, imageBaseUrl: string): string | null {
  if (imageUrl === null) return null;
  try {
    return new URL(imageUrl, imageBaseUrl).toString();
  } catch {
    return null;
  }
}

/** Both bounds present -> the query; `null`/`null` -> no query (the API's own default window). */
export function rangeParams(from: string | null, to: string | null): Record<string, string> {
  return from !== null && to !== null ? { from, to } : {};
}
