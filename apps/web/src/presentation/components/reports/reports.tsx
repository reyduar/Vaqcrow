"use client";

import { useCallback, useMemo, useState } from "react";
import type { AvailableRange, ReportPort, ReportSalesPort } from "@/application/ports/report-port";
import { REPORTS_COPY } from "@/application/reports/copy";
import { buildPeriodPresets, formatPeriodRange, type PeriodPreset } from "@/application/reports/periods";
import {
  createBrowserReportPort,
  createBrowserReportSalesPort
} from "@/infrastructure/reports/create-report-port";
import { useInvestorReport } from "@/state/use-investor-report";
import { useReportSales } from "@/state/use-report-sales";
import { ErrorState } from "../error-state";
import { PageHeading } from "../page-heading";
import { Skeleton } from "../skeleton";
import { ReportExport } from "./report-export";
import { ReportPeriodSelector } from "./report-period-selector";
import { ReportsView } from "./reports-view";

/**
 * `/reports` controller (Feature #430, WU2). It owns the two SWR reads (the
 * report and the sales block, each with its own failure), the selected range
 * and the preset/custom-range wiring; the presentation lives in
 * `reports-view.tsx` and the pure mappings in `application/reports/`.
 *
 * The report is available to **every authenticated role**; the page itself does
 * not gate (the route gate is WU4). Ports are injectable so tests never touch
 * the network, and are captured once with `useState` so an omitted prop is
 * never re-created.
 *
 * The default state is a `null`/`null` range: it asks the API for its own
 * default window (the last six months up to the investor's last period) and,
 * crucially, for `availableRange`, from which the presets and the custom-range
 * bounds are built — no year is hard-coded in the web.
 */

const EMPTY_AVAILABLE: AvailableRange = { firstPeriod: null, lastPeriod: null };

export interface ReportsProps {
  /** Injectable for tests; production passes the browser port from the container. */
  readonly reportPort?: ReportPort | null;
  /** Injectable for tests; production passes the browser sales port. */
  readonly salesPort?: ReportSalesPort | null;
}

export function Reports({ reportPort, salesPort }: ReportsProps) {
  const [port] = useState<ReportPort | null>(() => reportPort ?? null);
  const [sales] = useState<ReportSalesPort | null>(() => salesPort ?? null);
  const [range, setRange] = useState<{ readonly from: string | null; readonly to: string | null }>({
    from: null,
    to: null
  });

  const reportState = useInvestorReport(port, range.from, range.to, true);
  const salesState = useReportSales(sales, range.from, range.to, true);
  const report = reportState.data;
  const available = report?.availableRange ?? EMPTY_AVAILABLE;
  const { firstPeriod, lastPeriod } = available;

  const presets = useMemo(() => buildPeriodPresets({ firstPeriod, lastPeriod }), [firstPeriod, lastPeriod]);

  const defaultRangeLabel = useMemo(() => {
    const sixMonths = presets.find((preset) => preset.id === "6m");
    if (sixMonths) return sixMonths.label;
    return report ? formatPeriodRange(report.range.from, report.range.to) : "";
  }, [presets, report]);

  const rangeLabel = useMemo(() => {
    if (range.from === null || range.to === null) {
      return report ? formatPeriodRange(report.range.from, report.range.to) : "";
    }
    return formatPeriodRange(range.from, range.to);
  }, [range.from, range.to, report]);

  const selectedPresetId: PeriodPreset["id"] | null = useMemo(() => {
    if (range.from === null) return "6m";
    return presets.find((preset) => preset.from === range.from && preset.to === range.to)?.id ?? null;
  }, [range.from, range.to, presets]);

  const onSelectPreset = useCallback(
    (id: PeriodPreset["id"]) => {
      const preset = presets.find((candidate) => candidate.id === id);
      if (preset) setRange({ from: preset.from, to: preset.to });
    },
    [presets]
  );

  const onCustomRange = useCallback((from: string, to: string) => {
    setRange({ from, to });
  }, []);

  const onResetRange = useCallback(() => {
    setRange({ from: null, to: null });
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <PageHeading
        title={REPORTS_COPY.title}
        subtitle={REPORTS_COPY.subtitle}
        action={
          <div className="flex flex-wrap items-end justify-end gap-2">
            {presets.length > 0 ? (
              <ReportPeriodSelector
                presets={presets}
                selectedPresetId={selectedPresetId}
                available={available}
                onSelectPreset={onSelectPreset}
                onCustomRange={onCustomRange}
              />
            ) : null}
            <ReportExport />
          </div>
        }
      />

      {reportState.isLoading ? (
        <Skeleton shapes={["card", "line", "line"]} label="Cargando tu informe" />
      ) : reportState.loadFailed || report === null ? (
        <ErrorState
          title="No pudimos cargar tu informe"
          message="El servicio no respondió. Ningún dato ni aporte se modificó."
          onRetry={reportState.reload}
          retryLabel="Reintentar"
        />
      ) : (
        <ReportsView
          report={report}
          sales={salesState}
          rangeLabel={rangeLabel}
          defaultRangeLabel={defaultRangeLabel}
          onRetrySales={salesState.reload}
          onResetRange={onResetRange}
        />
      )}
    </div>
  );
}

/** The browser-wired entry point: the `(app)/reports` route mounts this. */
export function ReportsContainer() {
  const [reportPort] = useState(() => createBrowserReportPort());
  const [salesPort] = useState(() => createBrowserReportSalesPort());
  return <Reports reportPort={reportPort} salesPort={salesPort} />;
}
