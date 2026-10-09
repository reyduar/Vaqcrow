import type { InvestorKycRepositoryPort } from "../ports/investor-kyc-repository-port.js";
import type { InvestorKycStatus } from "./get-investor-kyc.js";

/**
 * The investor's simulated KYC approval (`POST /investor-kyc`, Feature #422,
 * WU4).
 *
 * The caller's `userId` always comes from the verified principal, never from a
 * body or query. The approval is simulated and auto-granted (owner decision D2):
 * there is no admin step and no rejection branch. The repository's `approve` is
 * idempotent, so a replayed request returns the existing record unchanged; the
 * use case surfaces `created` so the route can answer 201 on first create and
 * 200 on a replay. A repository failure is `unavailable`, never a false
 * approval.
 */

export interface ApproveInvestorKycDependencies {
  readonly kyc: Pick<InvestorKycRepositoryPort, "approve">;
}

export type ApproveInvestorKycResult =
  | { readonly ok: true; readonly value: InvestorKycStatus & { readonly created: boolean } }
  | { readonly ok: false; readonly error: { readonly code: "unavailable" } };

export async function approveInvestorKyc(
  dependencies: ApproveInvestorKycDependencies,
  userId: string
): Promise<ApproveInvestorKycResult> {
  const approved = await dependencies.kyc.approve(userId);
  if (!approved.ok) {
    return { ok: false, error: { code: "unavailable" } };
  }

  return {
    ok: true,
    value: {
      approved: true,
      approvedAt: approved.value.approvedAt,
      simulado: approved.value.simulado,
      created: approved.value.created
    }
  };
}
