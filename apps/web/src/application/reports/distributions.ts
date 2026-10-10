import type {
  ReportLatestDistribution,
  ReportSalesByPymeEntry
} from "@/application/ports/report-port";
import type { ReportLatestDistributionState, ReportSalesByPymeStatus } from "@vaqcrow/contracts";
import { formatArsAmount, formatDate, formatXlmAmount } from "./format";
import { formatMonthName } from "./periods";

/**
 * The "Últimas distribuciones" table and the "Ventas declaradas por PyME" block
 * of `Vaqcrow Informes.dc.html` (Feature #430, WU2). Pure and React-free: every
 * cell is already formatted and carries a tone the presentation maps to a
 * `Badge`. Meaning never lives in colour alone — each row also has a `state`
 * or `statusLabel` string.
 *
 * The distribution vocabulary is the persisted one
 * (`confirmed | submitted | failed`); `submitted` keeps the template's
 * "Enviada · pendiente", and `failed` reuses the evidence corpus' "Fallida".
 * The sales notes are generic because the template's per-PyME strings ("Abril
 * faltante · junio con anomalía") are not derivable from the response —
 * owner-pending.
 */

export type ReportTone = "neutral" | "success" | "caution" | "critical";

export const REPORT_DISTRIBUTION_STATE_COPY: Readonly<Record<ReportLatestDistributionState, string>> = {
  confirmed: "Confirmada",
  submitted: "Enviada · pendiente",
  failed: "Fallida"
};

export const REPORT_DISTRIBUTION_STATE_TONE: Readonly<Record<ReportLatestDistributionState, ReportTone>> = {
  confirmed: "success",
  submitted: "caution",
  failed: "critical"
};

export interface ReportDistributionRow {
  readonly date: string;
  readonly pyme: string;
  readonly sales: string;
  readonly share: string;
  readonly state: string;
  readonly tone: ReportTone;
  /** The distribution's Testnet hash (#438/WU5). */
  readonly transactionHash: string;
  /** API-built explorer link; `null` renders the hash without a link. */
  readonly explorerUrl: string | null;
}

export function toDistributionRows(
  distributions: readonly ReportLatestDistribution[]
): readonly ReportDistributionRow[] {
  return distributions.map((distribution) => ({
    date: formatDate(distribution.date),
    pyme: distribution.pyme,
    sales: distribution.declaredSalesArs === null ? "Sin dato" : formatArsAmount(distribution.declaredSalesArs),
    share: distribution.shareXlm === null ? "Sin distribución" : formatXlmAmount(distribution.shareXlm),
    state: REPORT_DISTRIBUTION_STATE_COPY[distribution.state],
    tone: REPORT_DISTRIBUTION_STATE_TONE[distribution.state],
    transactionHash: distribution.transactionHash,
    explorerUrl: distribution.explorerUrl
  }));
}

export const REPORT_SALES_STATUS_COPY: Readonly<Record<ReportSalesByPymeStatus, string>> = {
  reported: "Declarada en término",
  missing: "Sin declaración en el período",
  anomalous: "Declaración con anomalía"
};

export const REPORT_SALES_STATUS_TONE: Readonly<Record<ReportSalesByPymeStatus, ReportTone>> = {
  reported: "neutral",
  missing: "caution",
  anomalous: "caution"
};

export interface ReportSalesRow {
  readonly name: string;
  readonly sector: string;
  readonly imageSrc: string | null;
  /** Month name only, e.g. `agosto` ("Ventas de agosto · SIMULADO"). */
  readonly monthLabel: string;
  readonly amount: string;
  readonly status: ReportSalesByPymeStatus;
  readonly statusLabel: string;
  readonly tone: ReportTone;
}

export function toSalesRows(pymes: readonly ReportSalesByPymeEntry[]): readonly ReportSalesRow[] {
  return pymes.map((pyme) => ({
    name: pyme.name,
    sector: pyme.sector,
    imageSrc: pyme.imageSrc,
    monthLabel: formatMonthName(pyme.period),
    amount: pyme.salesArs === null ? "Sin dato" : formatArsAmount(pyme.salesArs),
    status: pyme.status,
    statusLabel: REPORT_SALES_STATUS_COPY[pyme.status],
    tone: REPORT_SALES_STATUS_TONE[pyme.status]
  }));
}
