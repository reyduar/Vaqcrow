import type { WalletConnectionPort } from "@/application/ports/wallet-connection-port";
import { createBrowserAuthSession } from "@/infrastructure/auth/browser-auth-session";
import { createLazyAuthSession } from "@/infrastructure/auth/lazy-auth-session";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";
import { HttpWalletConnectionGateway } from "./http-wallet-connection-gateway";
import { UNAVAILABLE_WALLET_CONNECTION_PORT } from "./unavailable-wallet-connection-port";

export { UNAVAILABLE_WALLET_CONNECTION_PORT };

/**
 * Builds the wallet-connection port from the API base URL and, when given, the
 * session's access token. `null` when no backend is configured: the UI then
 * runs on `UNAVAILABLE_WALLET_CONNECTION_PORT` and refuses to connect.
 */
export function createWalletConnectionPort(
  baseUrl: string | undefined,
  accessToken?: AccessTokenProvider
): WalletConnectionPort | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return HttpWalletConnectionGateway.create(trimmed, accessToken);
}

/**
 * The browser default used by the wizard's review step and `/company`. It
 * reuses the app's existing browser auth wiring to attach the session's
 * `Authorization: Bearer` token, following the same lazy-session approach as
 * `createBrowserBusinessPort` and `createBrowserUploadPort` (the session store
 * does not expose `getAccessToken` to components today; a later unit should
 * share the single session port and drop this duplicate).
 */
export function createBrowserWalletConnectionPort(): WalletConnectionPort {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return UNAVAILABLE_WALLET_CONNECTION_PORT;
  const session = createLazyAuthSession(createBrowserAuthSession);
  return HttpWalletConnectionGateway.create(baseUrl, () => session.getAccessToken());
}
