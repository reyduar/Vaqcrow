import type { ReportPort, ReportResult, ReportSalesPort, ReportSalesResult } from "@/application/ports/report-port";

/**
 * Null-object report ports used when no backend base URL is configured (#480):
 * every read answers `not_configured` — the honest "no API wired up", which the
 * page renders as a calm notice, **not** as a service failure and never as an
 * invented empty report.
 */
export const UNAVAILABLE_REPORT_PORT: ReportPort = Object.freeze({
  async get(): Promise<ReportResult> {
    return { ok: false, code: "not_configured" };
  }
});

export const UNAVAILABLE_REPORT_SALES_PORT: ReportSalesPort = Object.freeze({
  async get(): Promise<ReportSalesResult> {
    return { ok: false, code: "not_configured" };
  }
});
