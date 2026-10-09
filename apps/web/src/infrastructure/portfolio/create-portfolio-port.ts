import type { PortfolioPort } from "@/application/ports/portfolio-port";
import { createBrowserAuthSession } from "@/infrastructure/auth/browser-auth-session";
import { createLazyAuthSession } from "@/infrastructure/auth/lazy-auth-session";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";
import { HttpPortfolioGateway } from "./http-portfolio-gateway";
import { UNAVAILABLE_PORTFOLIO_PORT } from "./unavailable-portfolio-port";

export { UNAVAILABLE_PORTFOLIO_PORT };

/** Builds the portfolio port from the API base URL; `null` without a backend. */
export function createPortfolioPort(baseUrl: string | undefined, accessToken?: AccessTokenProvider): PortfolioPort | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return HttpPortfolioGateway.create(trimmed, accessToken);
}

/**
 * Browser default. The portfolio is `INVERSOR`-only, so it reuses the app's lazy
 * browser session to attach the `Authorization: Bearer` token; without a
 * configured base URL it is the null object so the page stays honest.
 */
export function createBrowserPortfolioPort(): PortfolioPort {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return UNAVAILABLE_PORTFOLIO_PORT;
  const session = createLazyAuthSession(createBrowserAuthSession);
  return HttpPortfolioGateway.create(baseUrl, () => session.getAccessToken());
}
