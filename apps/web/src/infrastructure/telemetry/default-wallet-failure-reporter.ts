import type { WalletFailureEvent } from "@vaqcrow/contracts";
import type { WalletFailureReporterPort } from "@/application/ports/wallet-failure-reporter-port";
import { createBrowserAuthSession } from "@/infrastructure/auth/browser-auth-session";
import { createLazyAuthSession } from "@/infrastructure/auth/lazy-auth-session";
import { type AccessTokenProvider, AxiosHttpClient } from "@/infrastructure/http/axios-http-client";
import { HttpWalletFailureReporter } from "./http-wallet-failure-reporter";

/**
 * Builds the reporter from the API base URL and the session's access token.
 * `null` when no backend is configured.
 */
export function createWalletFailureReporter(
  baseUrl: string | undefined,
  accessToken: AccessTokenProvider
): WalletFailureReporterPort | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return new HttpWalletFailureReporter(AxiosHttpClient.create({ baseUrl: trimmed, accessToken }));
}

/**
 * The browser default the wallet adapter falls back to. `POST
 * /telemetry/wallet-failures` is `AUTHENTICATED`, so the report carries the
 * signed-in session's `Authorization: Bearer` token via the same lazy-session
 * approach as `createBrowserSmeRequestGateway`.
 *
 * Resolution happens on the first report, never at import time: the wallet
 * adapter is built as a module-level constant in several components, where
 * reading the API base URL or building the Supabase client may not be safe yet.
 * A missing base URL yields `null`, and `report` becomes a no-op.
 */
function resolveDefault(): WalletFailureReporterPort | null {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return null;
  const session = createLazyAuthSession(createBrowserAuthSession);
  return createWalletFailureReporter(baseUrl, () => session.getAccessToken());
}

export const defaultWalletFailureReporter: WalletFailureReporterPort = {
  report(event: WalletFailureEvent): void {
    // Best-effort by contract: resolution and construction are guarded too, so a
    // synchronous throw here can never mask the wallet's own `WalletError`.
    try {
      resolveDefault()?.report(event);
    } catch {
      // Telemetry must never affect the wallet path.
    }
  }
};
