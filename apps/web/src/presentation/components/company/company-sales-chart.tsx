import { salesChartTitle, toSalesBars } from "@/application/company/sales";
import type { MyCampaign } from "@/application/ports/my-campaigns-port";
import { Badge } from "../badge";
import { BarChart } from "../bar-chart";

/**
 * «Ventas declaradas · <año>» of the PyME dashboard (Feature #434, WU2). It
 * reuses the shared `BarChart` with the API's own `reported | missing |
 * anomalous` statuses (the chart renders the non-colour "Sin dato"/"Atípico"
 * markers), so a `missing` month is an honest absence, never a zero bar.
 *
 * Presentational: the bars, the title and the year are already derived by
 * `application/company/sales.ts`. The campaign name is the caption so a
 * multi-campaign PyME always knows whose sales the chart is showing.
 */
export interface CompanySalesChartProps {
  readonly campaign: MyCampaign;
}

export function CompanySalesChart({ campaign }: CompanySalesChartProps) {
  const bars = toSalesBars(campaign.sales);

  return (
    <section
      aria-label={`Ventas declaradas de ${campaign.name}`}
      className="flex flex-col gap-4 rounded-card border border-border p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <BarChart
          title={salesChartTitle(campaign.sales)}
          caption={`${campaign.name} · ARS · SIMULADO`}
          series={bars}
          tableCaption={`Ventas declaradas de ${campaign.name}`}
          valueColumnLabel="Ventas"
        />
        <Badge variant="simulado" label="SIMULADO" lang="es" />
      </div>
    </section>
  );
}
