import type { MyCampaign } from "@/application/ports/my-campaigns-port";
import { formatArsAmount, formatDeadlineDate } from "./format";

/**
 * The two stat tiles of the PyME dashboard (Feature #434, WU2): «Fondeado» with
 * the total raised and «Aportantes» with the contributor total. Pure and
 * React-free.
 *
 * Honesty rules: a raised total is `Sin dato` when **any** campaign lacks its
 * snapshot — a partial sum with a missing addend is not an honest total, so it
 * is never fabricated. The deadline in the note is the earliest close date
 * across the campaigns; when no campaign carries a parseable date the note
 * drops the date rather than inventing one. The contributor figure sums each
 * campaign's own `contributorsCount` (the endpoint's per-campaign count).
 */

export interface DashboardStat {
  readonly id: "funded" | "contributors";
  readonly label: string;
  readonly value: string;
  readonly note: string;
}

const SIN_DATO = "Sin dato";

function earliestDeadline(campaigns: readonly MyCampaign[]): string {
  let earliest: number | null = null;
  for (const campaign of campaigns) {
    const time = new Date(campaign.deadline).getTime();
    if (Number.isNaN(time)) continue;
    if (earliest === null || time < earliest) earliest = time;
  }
  return earliest === null ? "" : formatDeadlineDate(new Date(earliest).toISOString());
}

export function buildDashboardStats(campaigns: readonly MyCampaign[]): readonly DashboardStat[] {
  const raisedKnown = campaigns.every((campaign) => campaign.raisedArs !== null);
  const raisedTotal = campaigns.reduce((total, campaign) => total + (campaign.raisedArs ?? 0), 0);
  const goalTotal = campaigns.reduce((total, campaign) => total + campaign.goalArs, 0);
  const contributors = campaigns.reduce((total, campaign) => total + campaign.contributorsCount, 0);

  const deadline = earliestDeadline(campaigns);
  const fundedNote = deadline === "" ? `de ${formatArsAmount(goalTotal)}` : `de ${formatArsAmount(goalTotal)} · cierra el ${deadline}`;

  return [
    {
      id: "funded",
      label: "Fondeado",
      value: raisedKnown ? formatArsAmount(raisedTotal) : SIN_DATO,
      note: fundedNote
    },
    {
      id: "contributors",
      label: "Aportantes",
      value: String(contributors),
      note: "Cuentas de Testnet distintas"
    }
  ];
}
