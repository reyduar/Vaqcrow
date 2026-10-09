import type { MyCampaignDistributionState } from "@vaqcrow/contracts";
import type { MyCampaign, MyCampaignDistribution } from "@/application/ports/my-campaigns-port";
import { formatApproxXlmAmount, formatArsAmount, formatMonthYear } from "./format";

/**
 * The distribution rows of the PyME dashboard (Feature #434, WU2): they appear
 * nested under each campaign and aggregated in the standalone «Distribuciones»
 * section. Pure and React-free.
 *
 * The vocabulary is PyME-facing and taken from the template's PyME mode
 * (`Vaqcrow Portafolio.dc.html`): `submitted` -> "Calculada · pendiente de tu
 * firma", `confirmed` -> "Confirmada"; `failed` reuses the evidence corpus'
 * "Fallida". Money is the endpoint's own: the ARS principal plus the
 * approximate XLM, and `null` is the honest "Sin dato", never a zero.
 */

export type DistributionTone = "neutral" | "success" | "caution" | "critical";

export const MY_CAMPAIGN_DISTRIBUTION_STATE_COPY: Readonly<Record<MyCampaignDistributionState, string>> = {
  submitted: "Calculada · pendiente de tu firma",
  confirmed: "Confirmada",
  failed: "Fallida"
};

export const MY_CAMPAIGN_DISTRIBUTION_STATE_TONE: Readonly<Record<MyCampaignDistributionState, DistributionTone>> = {
  submitted: "caution",
  confirmed: "success",
  failed: "critical"
};

const SIN_DATO = "Sin dato";

/** Only a `submitted` distribution still needs the PyME's signature. */
export function needsSignature(state: MyCampaignDistributionState): boolean {
  return state === "submitted";
}

export interface DistributionRow {
  readonly distributionId: string;
  /** `Agosto 2026`, or `null` for a legacy distribution with no period. */
  readonly periodLabel: string | null;
  readonly amountArs: string;
  readonly amountXlm: string;
  readonly stateLabel: string;
  readonly tone: DistributionTone;
}

function toDistributionRow(distribution: MyCampaignDistribution): DistributionRow {
  return {
    distributionId: distribution.distributionId,
    periodLabel: distribution.period === null ? null : formatMonthYear(distribution.period),
    amountArs: distribution.amountArs === null ? SIN_DATO : formatArsAmount(distribution.amountArs),
    amountXlm: distribution.amountXlm === null ? SIN_DATO : formatApproxXlmAmount(distribution.amountXlm),
    stateLabel: MY_CAMPAIGN_DISTRIBUTION_STATE_COPY[distribution.state],
    tone: MY_CAMPAIGN_DISTRIBUTION_STATE_TONE[distribution.state]
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
