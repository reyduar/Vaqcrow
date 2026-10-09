import type { PrincipalRole } from "@/application/ports/auth-session-port";
import type { CampaignDetail } from "@/application/ports/campaign-detail-port";

/**
 * The "Retirar" gate (Feature #422, WU5). React-free and dependency-free so the
 * rule is testable on its own, mirroring `campaign-contribution.ts`.
 *
 * Owner decision D4: reuse the vault engine's `withdraw`, gated on the campaign
 * still being in `funding` **and** the investor having a non-zero contribution.
 * A PYME never withdraws from its own campaign, an ADMIN never acts as an
 * investor, and there is nothing to withdraw before the first contribution.
 *
 * An unknown/absent contribution is **not** a zero: with nothing known the
 * control stays hidden rather than offering an action that cannot succeed.
 */
export interface WithdrawGateInput {
  /** The derived campaign status; only `funding` accepts a withdraw. */
  readonly status: CampaignDetail["status"];
  /** The signed-in viewer's verified role; only `INVERSOR` may withdraw. */
  readonly viewerRole: PrincipalRole | null;
  /** The campaign's vault id; `null`/blank when the demo has not persisted one. */
  readonly vaultAddress: string | null;
  /** The investor's own chain-observed contribution; `null`/`undefined` while unknown. */
  readonly investorContributionStroops: bigint | null | undefined;
}

export function canWithdraw(input: WithdrawGateInput): boolean {
  if (input.viewerRole !== "INVERSOR") return false;
  if (input.status !== "funding") return false;
  if (!input.vaultAddress || input.vaultAddress.trim() === "") return false;
  const contribution = input.investorContributionStroops;
  return contribution !== null && contribution !== undefined && contribution > 0n;
}
