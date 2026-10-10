import type { CSSProperties } from "react";
import { IoFlaskOutline } from "react-icons/io5";
import type { ReportChartPoint, ReportSeriesState } from "@/application/reports/series";
import { Badge } from "../badge";

/**
 * "Distribuciones recibidas por mes" (`Vaqcrow Informes.dc.html`, Feature #430,
 * WU2). Presentational: every label and number is already formatted by
 * `application/reports/series.ts`.
 *
 * Encodings are never colour-alone (template + `demo-ui.md` §2): a confirmed
 * month is a solid bar, a pending month is hatched, a `none` month is a dashed
 * stub, and the same distinction is repeated as text in the legend and in the
 * always-available accessible table (Mes / XLM / Estado).
 */
export interface ReportMonthlyChartProps {
  readonly series: readonly ReportChartPoint[];
  /** Already formatted, e.g. `abril – septiembre 2026`. */
  readonly rangeLabel: string;
  readonly isLoading?: boolean;
  readonly className?: string;
}

const GRID_BACKGROUND =
  "repeating-linear-gradient(to top, transparent 0, transparent 49px, var(--color-border) 49px, var(--color-border) 50px)";

const LEGEND: readonly { readonly state: ReportSeriesState; readonly label: string }[] = [
  { state: "confirmed", label: "Confirmada" },
  { state: "pending", label: "Pendiente de confirmación" },
  { state: "none", label: "Sin distribución" }
];

function barStyle(state: ReportSeriesState): CSSProperties {
  if (state === "confirmed") return { background: "var(--color-brand-accent)" };
  if (state === "pending") {
    return {
      background:
        "repeating-linear-gradient(45deg, var(--color-trust-caution) 0 3px, transparent 3px 7px)",
      border: "1.5px solid var(--color-trust-caution)"
    };
  }
  return { border: "1.5px dashed var(--color-control)" };
}

export function ReportMonthlyChart({ series, rangeLabel, isLoading = false, className }: ReportMonthlyChartProps) {
  return (
    <section
      aria-labelledby="report-chart-heading"
      className={`flex min-w-0 flex-col gap-4 rounded-card border border-border p-6 ${className ?? ""}`.trim()}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="report-chart-heading" className="m-0 text-[19px] font-bold">
            Distribuciones recibidas por mes
          </h2>
          <p className="m-0 mt-0.5 text-[13px] text-text-secondary">XLM de prueba · {rangeLabel}</p>
        </div>
        <Badge variant="simulado" label="SIMULADO" icon={IoFlaskOutline} lang="es" />
      </div>

      {isLoading ? (
        <div className="grid h-[220px] place-items-center rounded-control bg-page-surface text-[13px] text-text-secondary">
          Cargando serie…
        </div>
      ) : (
        <>
          <div
            aria-hidden="true"
            className="grid items-end gap-3 border-b border-control"
            style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))`, height: 200, backgroundImage: GRID_BACKGROUND }}
          >
            {series.map((point) => (
              <div key={point.period} className="flex h-full flex-col items-center justify-end gap-1">
                <span className="text-[11px] font-semibold text-text-secondary">{point.topLabel}</span>
                <div className="w-full rounded-t-[6px]" style={{ height: `${point.heightPercent}%`, ...barStyle(point.state) }} />
              </div>
            ))}
          </div>
          <div
            aria-hidden="true"
            className="grid gap-3 text-center text-xs text-text-secondary"
            style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }}
          >
            {series.map((point) => (
              <span key={point.period}>{point.shortLabel}</span>
            ))}
          </div>

          <div data-part="legend" className="flex flex-wrap gap-4 text-xs text-text-secondary">
            {LEGEND.map((item) => (
              <span key={item.state} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-3 w-3 rounded-[3px]" style={barStyle(item.state)} />
                {item.label}
              </span>
            ))}
          </div>

          <details className="border-t border-border pt-3">
            <summary className="flex min-h-8 cursor-pointer items-center text-sm font-semibold">Ver tabla accesible</summary>
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th scope="col" className="border-b border-border py-2 text-left text-xs font-semibold text-text-secondary">Mes</th>
                  <th scope="col" className="border-b border-border py-2 text-right text-xs font-semibold text-text-secondary">XLM</th>
                  <th scope="col" className="border-b border-border py-2 text-right text-xs font-semibold text-text-secondary">Estado</th>
                </tr>
              </thead>
              <tbody>
                {series.map((point) => (
                  <tr key={point.period}>
                    <th scope="row" className="border-b border-border py-2 text-left font-medium">{point.monthLabel}</th>
                    <td className="border-b border-border py-2 text-right font-semibold">{point.displayValue}</td>
                    <td className="border-b border-border py-2 text-right">{point.stateLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}
