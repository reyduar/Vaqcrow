import { buildReportKpis } from "@/application/reports/kpis";
import { toChartSeries } from "@/application/reports/series";
import type { InvestorReport } from "@/application/ports/report-port";
import type { ReportSalesState } from "@/state/use-report-sales";
import { ReportEmptyState } from "./report-empty-state";
import { ReportKpiGrid } from "./report-kpi-grid";
import { ReportLatestDistributions } from "./report-latest-distributions";
import { ReportMonthlyChart } from "./report-monthly-chart";
import { ReportSalesBlock } from "./report-sales-block";

/**
 * The investor report body (Feature #430, WU2): the KPI grid, the monthly
 * chart with the sales block beside it, and the latest-distributions table — or
 * the empty-period state. Presentational: the load state, the range and the
 * ports belong to `reports.tsx`; the pure mappings come from
 * `application/reports/`.
 *
 * The sales block has its own fetch and its own partial-error state, so it is
 * passed the sales `state` and its own retry instead of sharing the report's.
 */
export interface ReportsViewProps {
  readonly report: InvestorReport;
  readonly sales: ReportSalesState;
  /** Already formatted range label for the selected period. */
  readonly rangeLabel: string;
  /** Label of the default (last six months) range, for the empty-state CTA. */
  readonly defaultRangeLabel: string;
  readonly onRetrySales: () => void;
  readonly onResetRange: () => void;
}

export function ReportsView({
  report,
  sales,
  rangeLabel,
  defaultRangeLabel,
  onRetrySales,
  onResetRange
}: ReportsViewProps) {
  if (report.isEmpty) {
    return (
      <ReportEmptyState rangeLabel={rangeLabel} defaultRangeLabel={defaultRangeLabel} onReset={onResetRange} />
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <ReportKpiGrid kpis={buildReportKpis(report)} />

      <div
        className="grid items-start gap-6"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}
      >
        <ReportMonthlyChart
          series={toChartSeries(report.monthlySeries)}
          rangeLabel={rangeLabel}
          className="min-[880px]:col-span-2"
        />
        <ReportSalesBlock state={sales} onRetry={onRetrySales} />
      </div>

      <ReportLatestDistributions distributions={report.latestDistributions} />
    </div>
  );
}
