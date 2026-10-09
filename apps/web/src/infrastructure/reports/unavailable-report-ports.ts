import type { ReportPort, ReportResult, ReportSalesPort, ReportSalesResult } from "@/application/ports/report-port";

/**
 * Null-object report ports used when no backend base URL is configured: every
 * read is the sanitized `unavailable`, so the page shows its error state
 * instead of an invented empty report.
 */
export const UNAVAILABLE_REPORT_PORT: ReportPort = Object.freeze({
  async get(): Promise<ReportResult> {
    return { ok: false, code: "unavailable" };
  }
});

export const UNAVAILABLE_REPORT_SALES_PORT: ReportSalesPort = Object.freeze({
  async get(): Promise<ReportSalesResult> {
    return { ok: false, code: "unavailable" };
  }
});
