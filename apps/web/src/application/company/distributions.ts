import type { MyCampaignDistributionState, MyCampaignState } from "@vaqcrow/contracts";
import type { MyCampaign, MyCampaignDistribution } from "@/application/ports/my-campaigns-port";
import { formatApproxXlmAmount, formatArsAmount, formatMonthYear } from "./format";

/**
 * The distribution rows of the PyME dashboard (Feature #434, WU2): they appear
 * nested under each campaign and aggregated in the standalone «Distribuciones»
 * section. Pure and React-free.
 *
 * A persisted `submitted` distribution was already signed and sent by the PyME
 * (`signed_xdr` + `transaction_hash`), so it reads as "Enviada · pendiente de
 * confirmación" and never as an outstanding signature. The template's
 * "Calculada · pendiente de tu firma" state has no persisted source: it is a
 * *derivable* obligation — a `settled` campaign whose latest reported period has
 * no distribution — produced on demand by `POST /revenue-share-distributions`.
 * `confirmed` -> "Confirmada"; `failed` reuses the evidence corpus' "Fallida".
 * Money is the endpoint's own: the ARS principal plus the approximate XLM, and
 * `null` is the honest "Sin dato", never a zero.
 */

export type DistributionTone = "neutral" | "success" | "caution" | "critical";

export const MY_CAMPAIGN_DISTRIBUTION_STATE_COPY: Readonly<Record<MyCampaignDistributionState, string>> = {
  submitted: "Enviada · pendiente de confirmación",
  confirmed: "Confirmada",
  failed: "Fallida"
};

export const MY_CAMPAIGN_DISTRIBUTION_STATE_TONE: Readonly<Record<MyCampaignDistributionState, DistributionTone>> = {
  submitted: "caution",
  confirmed: "success",
  failed: "critical"
};

const SIN_DATO = "Sin dato";

/**
 * The distribution obligation only exists once the goal is reached: a `settled`
 * campaign is where `prepare` derives the latest reported period (and surfaces
 * its own handled error when that period is already distributed). A persisted
 * distribution row is never the entry point — `submitted`/`confirmed`/`failed`
 * rows have already been signed or resolved.
 */
export function canReviewAndSign(campaignState: MyCampaignState): boolean {
  return campaignState === "settled";
}

export interface DistributionRow {
  readonly distributionId: string;
  /** `Agosto 2026`, or `null` for a legacy distribution with no period. */
  readonly periodLabel: string | null;
  readonly amountArs: string;
  readonly amountXlm: string;
  readonly stateLabel: string;
  readonly tone: DistributionTone;
  /** The distribution's Testnet hash (#438/WU5). */
  readonly transactionHash: string;
  /** API-built explorer link; `null` renders the hash without a link. */
  readonly explorerUrl: string | null;
}

function toDistributionRow(distribution: MyCampaignDistribution): DistributionRow {
  return {
    distributionId: distribution.distributionId,
    periodLabel: distribution.period === null ? null : formatMonthYear(distribution.period),
    amountArs: distribution.amountArs === null ? SIN_DATO : formatArsAmount(distribution.amountArs),
    amountXlm: distribution.amountXlm === null ? SIN_DATO : formatApproxXlmAmount(distribution.amountXlm),
    stateLabel: MY_CAMPAIGN_DISTRIBUTION_STATE_COPY[distribution.state],
    tone: MY_CAMPAIGN_DISTRIBUTION_STATE_TONE[distribution.state],
    transactionHash: distribution.transactionHash,
    explorerUrl: distribution.explorerUrl
  };
}

export { toDistributionRow };

/** Rows for one campaign's own distributions, in the API's order. */
export function toDistributionRows(
  distributions: readonly MyCampaignDistribution[]
): readonly DistributionRow[] {
  return distributions.map(toDistributionRow);
}

export interface AggregateDistributionRow extends DistributionRow {
  readonly campaignName: string;
}

/** Every campaign's distributions flattened, each tagged with its campaign name. */
export function toAggregateDistributionRows(campaigns: readonly MyCampaign[]): readonly AggregateDistributionRow[] {
  return campaigns.flatMap((campaign) =>
    campaign.distributions.map((distribution) => ({ ...toDistributionRow(distribution), campaignName: campaign.name }))
  );
}
