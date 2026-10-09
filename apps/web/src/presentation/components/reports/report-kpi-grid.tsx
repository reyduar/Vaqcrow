import type { ReportKpi } from "@/application/reports/kpis";
import { Badge } from "../badge";

/**
 * The KPI grid of `Vaqcrow Informes.dc.html` (Feature #430, WU2). Presentational:
 * `label`, `value` and `note` are already formatted, and `source` decides the
 * badge (`TESTNET` accent tint / `SIMULADO` dashed outline) — exactly the
 * template's two treatments.
 *
 * It is a dedicated tile rather than the shared `KpiTile` (#314) because that
 * primitive's badge slot renders a `SIMULADO`-only `simuladoLabel`; these KPIs
 * need either of two source badges.
 */
export interface ReportKpiGridProps {
  readonly kpis: readonly ReportKpi[];
  readonly className?: string;
}

export function ReportKpiGrid({ kpis, className }: ReportKpiGridProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`grid gap-4 ${className ?? ""}`.trim()}
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))" }}
    >
      {kpis.map((kpi) => (
        <dl key={kpi.id} className="m-0 flex flex-col gap-2 rounded-card border border-border p-[18px]">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[13px] font-medium text-text-secondary">{kpi.label}</dt>
            <Badge variant={kpi.source === "TESTNET" ? "testnet" : "simulado"} label={kpi.source} lang="es" size="compact" />
          </div>
          <dd className="m-0 text-2xl leading-tight font-bold tracking-[-0.02em] tabular-nums">{kpi.value}</dd>
          <dd className="m-0 text-[13px] text-text-secondary">{kpi.note}</dd>
        </dl>
      ))}
    </div>
  );
}
