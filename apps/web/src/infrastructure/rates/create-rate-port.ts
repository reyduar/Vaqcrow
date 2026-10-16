import type { RatePort } from "@/application/ports/rate-port";
import { createBrowserAuthSession } from "@/infrastructure/auth/browser-auth-session";
import { createLazyAuthSession } from "@/infrastructure/auth/lazy-auth-session";
import { HttpRateGateway } from "./http-rate-gateway";

/** Without a backend there is no rate: the ARS label stays hidden, never invented. */
export const UNAVAILABLE_RATE_PORT: RatePort = {
  getCurrent: async () => ({ ok: false, code: "unavailable" })
};

/**
 * Browser default (#572). It reuses the app's lazy browser session to attach
 * the `Authorization: Bearer` token; without a configured base URL it is the
 * null object.
 */
export function createBrowserRatePort(): RatePort {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return UNAVAILABLE_RATE_PORT;
  const session = createLazyAuthSession(createBrowserAuthSession);
  return HttpRateGateway.create(baseUrl, () => session.getAccessToken());
}
