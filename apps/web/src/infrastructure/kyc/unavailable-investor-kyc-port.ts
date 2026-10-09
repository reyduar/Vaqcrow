import type { InvestorKycPort, InvestorKycResult } from "@/application/ports/investor-kyc-port";

/**
 * Null-object investor-KYC port used when no backend base URL is configured:
 * every read and write is the sanitized `unavailable`, so the UI shows its
 * failure state instead of inventing an approval.
 */
export const UNAVAILABLE_INVESTOR_KYC_PORT: InvestorKycPort = Object.freeze({
  async get(): Promise<InvestorKycResult> {
    return { ok: false, code: "unavailable" };
  },
  async approve(): Promise<InvestorKycResult> {
    return { ok: false, code: "unavailable" };
  }
});
