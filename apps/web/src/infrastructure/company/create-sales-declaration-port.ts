import type { SalesDeclarationPort } from "@/application/ports/sales-declaration-port";
import { createBrowserAuthSession } from "@/infrastructure/auth/browser-auth-session";
import { createLazyAuthSession } from "@/infrastructure/auth/lazy-auth-session";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";
import { HttpSalesDeclarationGateway } from "./http-sales-declaration-gateway";
import { UNAVAILABLE_SALES_DECLARATION_PORT } from "./unavailable-sales-declaration-port";

export { UNAVAILABLE_SALES_DECLARATION_PORT };

/** Builds the declaration port from the API base URL; `null` without a backend. */
export function createSalesDeclarationPort(
  baseUrl: string | undefined,
  accessToken?: AccessTokenProvider
): SalesDeclarationPort | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return HttpSalesDeclarationGateway.create(trimmed, accessToken);
}

/**
 * Browser default. The declaration is `PYME`-only, so it reuses the app's lazy
 * browser session to attach the `Authorization: Bearer` token; without a
 * configured base URL it is the null object so the form stays honest.
 */
export function createBrowserSalesDeclarationPort(): SalesDeclarationPort {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return UNAVAILABLE_SALES_DECLARATION_PORT;
  const session = createLazyAuthSession(createBrowserAuthSession);
  return HttpSalesDeclarationGateway.create(baseUrl, () => session.getAccessToken());
}
