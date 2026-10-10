import type { InvestorKycPort } from "@/application/ports/investor-kyc-port";
import { createBrowserAuthSession } from "@/infrastructure/auth/browser-auth-session";
import { createLazyAuthSession } from "@/infrastructure/auth/lazy-auth-session";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";
import { HttpInvestorKycGateway } from "./http-investor-kyc-gateway";
import { UNAVAILABLE_INVESTOR_KYC_PORT } from "./unavailable-investor-kyc-port";

export { UNAVAILABLE_INVESTOR_KYC_PORT };

/** Builds the KYC port from the API base URL and an optional token provider; `null` without a backend. */
export function createInvestorKycPort(
  baseUrl: string | undefined,
  accessToken?: AccessTokenProvider
): InvestorKycPort | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return HttpInvestorKycGateway.create(trimmed, accessToken);
}

/**
 * Browser default. It reuses the app's lazy browser session to attach the
 * `Authorization: Bearer` token; without a configured base URL it is the null
 * object so the KYC state stays honest.
 */
export function createBrowserInvestorKycPort(): InvestorKycPort {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return UNAVAILABLE_INVESTOR_KYC_PORT;
  const session = createLazyAuthSession(createBrowserAuthSession);
  return HttpInvestorKycGateway.create(baseUrl, () => session.getAccessToken());
}
