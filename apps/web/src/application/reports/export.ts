import type { InvestorReport, ReportSalesByPyme } from "@/application/ports/report-port";
import type { ReportMonthlyPointState } from "@vaqcrow/contracts";
import { REPORT_DISTRIBUTION_STATE_COPY, REPORT_SALES_STATUS_COPY } from "./distributions";
import { formatDate } from "./format";
import { formatPeriod, formatPeriodRange } from "./periods";

/**
 * The functional CSV export of the investor report (Feature #430, WU3; owner
 * decision D2). Pure and React-free: it takes the already-loaded report (and
 * the sales block when it loaded) and returns one deterministic CSV string, so
 * the download mechanism in `infrastructure/reports/csv-download.ts` stays a
 * one-line shell around it.
 *
 * Entity-integrity rules:
 * - Money and counts are the **canonical** values, never locale-formatted: XLM
 *   is the 7-decimal string as the API sends it (`850.0000000`), so a
 *   spreadsheet never has to parse a thousands separator out of a CSV field.
 * - `null` is an **empty cell**, never `0` — a missing declared sale, a
 *   `none` month or no pending total is an absence, not a figure.
 * - Rows are CRLF-terminated and the file starts with a UTF-8 BOM so Excel
 *   opens the Spanish accents and the `·` correctly.
 */

/** Excel recognises a UTF-8 CSV by this leading byte-order mark. */
export const UTF8_BOM = "\ufeff";

const CRLF = "\r\n";

/** The monthly series vocabulary, mirroring the chart's accessible table. */
const MONTHLY_STATE_COPY: Readonly<Record<ReportMonthlyPointState, string>> = {
  confirmed: "Confirmada",
  pending: "Pendiente de confirmación",
  none: "Sin distribución"
};

/** RFC 4180 escaping: quote a field containing a comma, a quote or a newline. */
function escapeCsvField(value: string): string {
  if (!/[",\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function csvRow(cells: readonly string[]): string {
  return cells.map(escapeCsvField).join(",");
}

/** `null` -> an empty cell; a number -> its plain decimal form. */
function numberCell(value: number | null): string {
  return value === null ? "" : String(value);
}

export function buildReportCsv(report: InvestorReport, sales?: ReportSalesByPyme | null): string {
  const lines: string[] = [
    csvRow(["Informe de actividad"]),
    csvRow(["Período", formatPeriodRange(report.range.from, report.range.to)]),
    "",
    csvRow(["Aportes"]),
    csvRow(["Métrica", "Valor", "Detalle", "Fuente"]),
    csvRow(["Aportado en el período", report.kpis.contributedXlm, "", "TESTNET"]),
    csvRow(["Distribuciones confirmadas", report.kpis.confirmedDistributionsXlm, "", "SIMULADO"]),
    csvRow([
      "Pendientes de confirmación",
      String(report.kpis.pendingDistributionsCount),
      report.kpis.pendingDistributionsXlm ?? "",
      "TESTNET"
    ]),
    csvRow(["Campañas con aporte", String(report.kpis.campaignsCount), "", "SIMULADO"]),
    "",
    csvRow(["Serie mensual"]),
    csvRow(["Período", "Mes", "XLM", "Estado"]),
    ...report.monthlySeries.map((point) =>
      csvRow([point.period, formatPeriod(point.period), point.amountXlm ?? "", MONTHLY_STATE_COPY[point.state]])
    ),
    "",
    csvRow(["Últimas distribuciones"]),
    csvRow(["Fecha", "PyME", "Ventas declaradas (ARS)", "Participación (XLM)", "Estado"]),
    ...report.latestDistributions.map((distribution) =>
      csvRow([
        formatDate(distribution.date),
        distribution.pyme,
        numberCell(distribution.declaredSalesArs),
        distribution.shareXlm ?? "",
        REPORT_DISTRIBUTION_STATE_COPY[distribution.state]
      ])
    )
  ];

  if (sales) {
    lines.push(
      "",
      csvRow(["Ventas declaradas por PyME"]),
      csvRow(["PyME", "Sector", "Período", "Ventas (ARS)", "Estado"]),
      ...sales.pymes.map((pyme) =>
        csvRow([
          pyme.name,
          pyme.sector,
          formatPeriod(pyme.period),
          numberCell(pyme.salesArs),
          REPORT_SALES_STATUS_COPY[pyme.status]
        ])
      )
    );
  }

  return `${UTF8_BOM}${lines.join(CRLF)}${CRLF}`;
}
