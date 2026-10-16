import type {
  ApplicationId,
  CorrelationId,
  DistributionRecipient,
  RevenueShareDerivation,
  SalesPeriodContract
} from "@vaqcrow/contracts";
import {
  allocateRevenueShare,
  calculateRevenueShareObligation,
  demoRevenueShareRule
} from "@vaqcrow/domain";
import type { RevenueSharePeriod } from "@vaqcrow/domain";
import { reconcileCampaign } from "./reconcile-campaign.js";
import type { ApplicationReviewRepositoryPort } from "../ports/application-review-repository-port.js";
import type { CampaignRepositoryPort } from "../ports/campaign-repository-port.js";
import type { CampaignVaultChainPort } from "../ports/campaign-vault-chain-port.js";
import { toChainCampaignSnapshot } from "../ports/campaign-vault-chain-port.js";
import type { RevenueShareDistributionCampaignReadPort } from "../ports/revenue-share-distribution-repository-port.js";
import type { RevenueShareDistributionRecord } from "../ports/revenue-share-distribution-repository-port.js";
import type { SalesDataProviderPort } from "../ports/sales-data-provider-port.js";
import type { SmeRequestRepositoryPort } from "../ports/sme-request-repository-port.js";

/**
 * Derives, server-side, who a revenue-share distribution pays and how much
 * (T5a, "Option A"). Nothing here is supplied by a client: the recipients and
 * amounts are a function of the case, so a caller cannot declare a split the
 * case does not support.
 *
 * The derivation, in order:
 * 1. The campaign must exist, belong to the application and be `settled` — a
 *    vault that did not reach its goal has nothing to distribute. The signing
 *    account must be the campaign's SME account (`source_not_sme`): only the
 *    borrower owes the revenue share. The mirror is never trusted for the state:
 *    the campaign is reconciled from the chain (the same path `GET /campaigns/:id`
 *    uses) before it is read, so a mirror that still says `open` after the vault
 *    settled derives, and a chain that cannot be read is `unavailable` rather
 *    than a derivation from a possibly stale state.
 * 2. The obligation is the domain engine's (`demoRevenueShareRule`: 450 bps,
 *    floor, `RS-2026-01`) over **one period**: the latest `reported` period of
 *    the SME's sales feed. The demo story records the next period first, so the
 *    newest reported month is the one being settled. Whole pesos are the
 *    domain's minor unit here; a sales amount that is not an integer is refused
 *    rather than rounded.
 * 3. ARS has no on-chain value, so the obligation is converted to stroops in the
 *    proportion the campaign was funded, not at an invented quote:
 *    `stroops = floor(obligationArs x goalStroops / approvedLimitArs)`, with the
 *    limit taken from the persisted human decision. Investors therefore receive
 *    in the same proportion they funded. The derivation is labeled simulated.
 * 4. The stroops are allocated pro-rata by contribution (the engine's
 *    largest-remainder method, so the parts sum exactly), enforcing the rule's
 *    per-contributor 1.5× cap: each contributor is capped at
 *    `floor(contribution × 3 / 2)` and stops being paid once their confirmed
 *    distributions reach it (#580). A zero allocation is dropped — a payment of
 *    nothing is not expressible on-chain — and the source account is never paid.
 * 5. When every contributor is at their cap the agreement is finished, and the
 *    derivation reports that terminal state instead of re-deriving an empty
 *    distribution.
 *
 * The chain cannot enumerate contributors, so the mirror's rows are the only
 * list available. The mirror is trusted only when it is complete: its
 * contributions must add up to the campaign total, otherwise the split would
 * silently shortchange an investor nobody reconciled (`contributions_incomplete`).
 *
 * Each contributor's accumulator is **derived, never stored** (`S4`): the
 * campaign's distribution repository already persists one row per recipient with
 * `(accountId, amountStroops)`, and `campaign_contribution.investor_account_id`
 * and `revenue_share_distribution_recipient.account_id` are the same Stellar
 * account id, so an exact string match is the join. The accumulator is the sum of
 * the `confirmed` distributions whose recipient is the contributor, which is why
 * no table, column or migration was added. Only `confirmed` counts: `submitted`
 * has not moved money and `failed` never will.
 *
 * Every failure is a typed value; nothing is thrown.
 */

export interface DeriveRevenueShareDistributionDeps {
  readonly campaigns: Pick<CampaignRepositoryPort, "findById" | "findContributions" | "reconcile">;
  readonly chain: Pick<CampaignVaultChainPort, "readCampaign">;
  readonly applicationReviews: Pick<ApplicationReviewRepositoryPort, "readLatestHumanDecision">;
  readonly smeRequests: Pick<SmeRequestRepositoryPort, "findByApplicationId">;
  readonly salesData: Pick<SalesDataProviderPort, "getPeriods">;
  /**
   * The campaign's distributions, read to derive each contributor's accumulator (#580): what has
   * already been paid is the sum of the `confirmed` distributions whose recipient is that
   * contributor. Read-only on purpose — the accumulator is derived from the existing ledger of
   * recipient rows, so no table, column or migration is needed.
   */
  readonly distributions: Pick<RevenueShareDistributionCampaignReadPort, "listByCampaign">;
}

export type DeriveRevenueShareDistributionErrorCode =
  | "campaign_not_found"
  | "application_mismatch"
  | "source_not_sme"
  | "campaign_not_settled"
  | "decision_not_approved"
  | "application_not_found"
  | "no_eligible_period"
  | "invalid_sales_data"
  | "no_contributors"
  | "contributions_incomplete"
  | "obligation_rounds_to_zero"
  /** Every contributor reached their 1.5× cap, so the agreement is finished (S3.7). */
  | "obligation_completed"
  | "unavailable";

export interface DerivedRevenueShareDistribution {
  readonly recipients: readonly DistributionRecipient[];
  readonly derivation: RevenueShareDerivation;
}

export type DeriveRevenueShareDistributionResult =
  | { readonly ok: true; readonly value: DerivedRevenueShareDistribution }
  | { readonly ok: false; readonly error: { readonly code: DeriveRevenueShareDistributionErrorCode } };

function fail(code: DeriveRevenueShareDistributionErrorCode): DeriveRevenueShareDistributionResult {
  return { ok: false, error: { code } };
}

export async function deriveRevenueShareDistribution(
  deps: DeriveRevenueShareDistributionDeps,
  input: {
    readonly applicationId: ApplicationId;
    readonly campaignId: string;
    /** The account that signs the distribution; it is never a recipient. */
    readonly sourceAccountId: string;
    /** Carried into the reconciliation write, which records who caused it. */
    readonly correlationId: CorrelationId;
  }
): Promise<DeriveRevenueShareDistributionResult> {
  const mirror = await deps.campaigns.findById(input.campaignId);

  if (!mirror.ok) {
    return fail(mirror.error.code === "not_found" ? "campaign_not_found" : "unavailable");
  }

  if (mirror.value.applicationId !== input.applicationId) return fail("application_mismatch");
  if (mirror.value.smeAccountId !== input.sourceAccountId) return fail("source_not_sme");

  // Fresh state: the mirror can lag the vault, so the chain is read and the
  // mirror reconciled before anything is derived from it. Any failure here is
  // `unavailable` — a vault the chain cannot be asked about is not derivable.
  const chainState = await deps.chain.readCampaign(mirror.value.contractAddress);

  if (!chainState.ok) return fail("unavailable");

  const reconciled = await reconcileCampaign(deps.campaigns, {
    campaignId: mirror.value.campaignId,
    snapshot: toChainCampaignSnapshot(chainState.value, []),
    correlationId: input.correlationId
  });

  if (!reconciled.ok) return fail("unavailable");

  const campaign = { ok: true as const, value: reconciled.value.campaign };

  if (campaign.value.state !== "settled") return fail("campaign_not_settled");

  const decision = await deps.applicationReviews.readLatestHumanDecision(input.applicationId);

  if (!decision.ok) {
    return fail(decision.error.code === "not_found" ? "decision_not_approved" : "unavailable");
  }

  const approvedLimitArs = decision.value.approvedLimitArs;

  if (decision.value.outcome !== "approved" || approvedLimitArs === null || approvedLimitArs <= 0) {
    return fail("decision_not_approved");
  }

  const request = await deps.smeRequests.findByApplicationId(input.applicationId);

  if (!request.ok) {
    return fail(request.error.code === "not_found" ? "application_not_found" : "unavailable");
  }

  const sales = await deps.salesData.getPeriods(request.value.request.smeReference);

  if (!sales.ok) {
    // A feed with no business for the reference is a declared absence of sales,
    // the same reading `getSmeRequest` gives it.
    return fail(sales.error.code === "not_found" ? "no_eligible_period" : "unavailable");
  }

  const latest = latestReportedPeriod(sales.value);

  if (latest === null) return fail("no_eligible_period");

  if (!Number.isSafeInteger(latest.amountArs)) return fail("invalid_sales_data");

  const salesArs = BigInt(latest.amountArs);

  const obligation = calculateRevenueShareObligation({
    rule: demoRevenueShareRule,
    periods: [{ period: latest.period, salesMinorUnits: salesArs, status: "reported" }]
  });

  if (!obligation.ok) return fail("invalid_sales_data");

  const obligationArs = obligation.value.obligationMinorUnits;

  // The same rule over the whole series, only for what it excluded: the
  // obligation above covers one period, the exclusions describe the series.
  const series = calculateRevenueShareObligation({
    rule: demoRevenueShareRule,
    periods: sales.value.map(toDomainPeriod)
  });

  if (!series.ok) return fail("invalid_sales_data");

  const contributions = await deps.campaigns.findContributions(input.campaignId);

  if (!contributions.ok) return fail("unavailable");

  const funded = contributions.value.filter((entry) => entry.amountStroops > 0n);

  if (funded.length === 0) return fail("no_contributors");

  const fundedTotal = funded.reduce((sum, entry) => sum + entry.amountStroops, 0n);

  if (fundedTotal !== campaign.value.totalStroops) return fail("contributions_incomplete");

  const goalStroops = campaign.value.goalStroops;
  const limit = BigInt(approvedLimitArs);
  const totalStroops = (obligationArs * goalStroops) / limit;

  if (totalStroops === 0n) return fail("obligation_rounds_to_zero");

  // Each contributor's accumulator (#580): what has already been paid to them, derived from the
  // campaign's confirmed distributions. A failed read is `unavailable`, never a silent 0n — a
  // zero accumulator is what would pay a capped contributor all over again.
  const distributions = await deps.distributions.listByCampaign(input.campaignId);

  if (!distributions.ok) return fail("unavailable");

  const distributedByAccount = confirmedStroopsByAccount(distributions.value);

  const allocation = allocateRevenueShare({
    rule: demoRevenueShareRule,
    obligationMinorUnits: totalStroops,
    contributors: funded.map((entry) => ({
      contributorId: entry.investorAccountId,
      contributionMinorUnits: entry.amountStroops,
      distributedMinorUnits: distributedByAccount.get(entry.investorAccountId) ?? 0n
    }))
  });

  if (!allocation.ok) return fail("invalid_sales_data");

  // The terminal state (S3.7): every contributor reached their 1.5× cap, so the agreement is
  // finished. Say so instead of deriving an all-zero distribution a caller would read as "nothing
  // this period".
  if (allocation.value.agreementComplete) return fail("obligation_completed");

  const recipients: DistributionRecipient[] = allocation.value.allocations
    .filter((entry) => entry.allocationMinorUnits > 0n && entry.contributorId !== input.sourceAccountId)
    .map((entry) => ({ accountId: entry.contributorId, amountStroops: entry.allocationMinorUnits }));

  if (recipients.length === 0) return fail("obligation_rounds_to_zero");

  return {
    ok: true,
    value: {
      recipients,
      derivation: {
        ruleVersion: obligation.value.ruleVersion,
        rateBps: obligation.value.rateBps,
        period: latest.period,
        salesArs: salesArs.toString(),
        obligationArs: obligationArs.toString(),
        excludedPeriods: series.value.excludedPeriods.map((entry) => ({
          period: entry.period,
          status: entry.status === "missing" ? "missing" : "anomalous",
          reason: entry.reason
        })),
        conversion: {
          goalStroops: goalStroops.toString(),
          approvedLimitArs: limit.toString(),
          totalStroops: totalStroops.toString()
        },
        simulated: true
      }
    }
  };
}

interface ReportedPeriod {
  readonly period: string;
  readonly amountArs: number;
}

/**
 * Each contributor's accumulator (#580), derived from the campaign's persisted
 * distributions rather than stored as new state (`S4`). The repository returns one row per
 * recipient with `(accountId, amountStroops)`, and the contributor id is that same Stellar
 * account id, so an exact string match is the join; a recipient that matches no contributor
 * simply is never read back. Only `confirmed` distributions count — `submitted` has not moved
 * money and `failed` never will — which is why no table, column or migration was needed.
 */
function confirmedStroopsByAccount(
  records: readonly RevenueShareDistributionRecord[]
): ReadonlyMap<string, bigint> {
  const totals = new Map<string, bigint>();

  for (const record of records) {
    if (record.state !== "confirmed") continue;

    for (const recipient of record.recipients) {
      totals.set(
        recipient.accountId,
        (totals.get(recipient.accountId) ?? 0n) + recipient.amountStroops
      );
    }
  }

  return totals;
}

/** `YYYY-MM` sorts lexicographically, so the greatest string is the latest month. */
function latestReportedPeriod(periods: readonly SalesPeriodContract[]): ReportedPeriod | null {
  let latest: ReportedPeriod | null = null;

  for (const entry of periods) {
    if (entry.status !== "reported" || entry.amountArs === null) continue;
    if (latest === null || entry.period > latest.period) {
      latest = { period: entry.period, amountArs: entry.amountArs };
    }
  }

  return latest;
}

/**
 * Only used to report exclusions: an amount that cannot be a whole number of
 * pesos is treated as absent here, because `latestReportedPeriod` already
 * refuses a non-integer amount on the period that is actually billed.
 */
function toDomainPeriod(entry: SalesPeriodContract): RevenueSharePeriod {
  const amount =
    entry.status === "reported" && entry.amountArs !== null && Number.isSafeInteger(entry.amountArs)
      ? BigInt(entry.amountArs)
      : null;

  return {
    period: entry.period,
    salesMinorUnits: amount,
    // A reported period without a usable amount is malformed input for the
    // engine; report it as missing data rather than aborting the derivation.
    status: entry.status === "reported" && amount === null ? "missing" : entry.status
  };
}
