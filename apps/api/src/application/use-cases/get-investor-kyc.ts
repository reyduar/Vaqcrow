import type { InvestorKycRepositoryPort } from "../ports/investor-kyc-repository-port.js";

/**
 * The investor's simulated KYC read (`GET /investor-kyc`, Feature #422, WU4).
 *
 * The caller's `userId` always comes from the verified principal, never from a
 * body or query, so a caller can only ever read its own record. A missing record
 * is the honest `approved: false` — never an error and never a fabricated
 * timestamp. A repository failure is `unavailable`, kept apart from "not yet
 * approved" so the UI never prompts a verification that already happened.
 */

export interface GetInvestorKycDependencies {
  readonly kyc: Pick<InvestorKycRepositoryPort, "find">;
}

export interface InvestorKycStatus {
  readonly approved: boolean;
  readonly approvedAt: string | null;
  readonly simulado: boolean;
}

export type GetInvestorKycResult =
  | { readonly ok: true; readonly value: InvestorKycStatus }
  | { readonly ok: false; readonly error: { readonly code: "unavailable" } };

export async function getInvestorKyc(
  dependencies: GetInvestorKycDependencies,
  userId: string
): Promise<GetInvestorKycResult> {
  const found = await dependencies.kyc.find(userId);
  if (!found.ok) {
    return { ok: false, error: { code: "unavailable" } };
  }

  if (found.value === null) {
    // No record: not yet verified. The nature of this demo's KYC is still
    // simulated, so `simulado` stays true rather than inventing a third state.
    return { ok: true, value: { approved: false, approvedAt: null, simulado: true } };
  }

  return { ok: true, value: { approved: true, approvedAt: found.value.approvedAt, simulado: found.value.simulado } };
}
