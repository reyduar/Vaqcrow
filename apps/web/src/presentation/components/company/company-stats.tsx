import { buildDashboardStats } from "@/application/company/stats";
import type { MyCampaign } from "@/application/ports/my-campaigns-port";
import { KpiTile } from "../kpi-tile";

/**
 * The PyME stat tiles of the dashboard (Feature #434, WU2): «Fondeado» and
 * «Aportantes». Presentational: every value and note arrives already computed
 * and formatted by `application/company/stats.ts`, so this component never
 * totals or formats money itself.
 */
export interface CompanyStatsProps {
  readonly campaigns: readonly MyCampaign[];
}

export function CompanyStats({ campaigns }: CompanyStatsProps) {
  const stats = buildDashboardStats(campaigns);

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}>
      {stats.map((stat) => (
        <KpiTile key={stat.id} label={stat.label} value={stat.value} note={stat.note} />
      ))}
    </div>
  );
}
