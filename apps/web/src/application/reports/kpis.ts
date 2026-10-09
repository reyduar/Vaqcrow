import type { InvestorReport } from "@/application/ports/report-port";
import { formatXlmAmount } from "./format";

/**
 * The four headline KPIs of `Vaqcrow Informes.dc.html` (Feature #430, WU2).
 * Pure and React-free: every value and note is already formatted, and the
 * `source` badge is `TESTNET` for figures proven in the ledger ("aportado",
 * "pendientes") and `SIMULADO` for computed ones ("distribuciones
 * confirmadas", "campañas con aporte"), exactly as the template writes them.
 *
 * Honesty rules: `null` is rendered as "Sin pendientes", never as a
 * `0,0000000 XLM`; the template's hard-coded campaign breakdown is not
 * derivable from the report response, so a neutral count sentence replaces it.
 */

export type ReportSource = "TESTNET" | "SIMULADO";

export interface ReportKpi {
  readonly id: "contributed" | "confirmed" | "pending" | "campaigns";
  readonly label: string;
  readonly value: string;
  readonly note: string;
  readonly source: ReportSource;
}

function pendingNote(count: number, pendingXlm: string | null): string {
  if (count === 0 || pendingXlm === null) return "Sin pendientes en el período";
  return `${formatXlmAmount(pendingXlm)} · ${count === 1 ? "enviada" : "enviadas"}`;
}

function campaignsNote(count: number): string {
  if (count === 0) return "Sin campañas con aporte en el período";
  return `${count} ${count === 1 ? "campaña" : "campañas"} con aporte en el período`;
}

export function buildReportKpis(report: InvestorReport): readonly ReportKpi[] {
  const { kpis } = report;
  return [
    {
      id: "contributed",
      label: "Aportado en el período",
      value: formatXlmAmount(kpis.contributedXlm),
      note: "Ledger de Testnet",
      source: "TESTNET"
    },
    {
      id: "confirmed",
      label: "Distribuciones confirmadas",
      value: formatXlmAmount(kpis.confirmedDistributionsXlm),
      note: "Confirmadas en el ledger",
      source: "SIMULADO"
    },
    {
      id: "pending",
      label: "Pendientes de confirmación",
      value: String(kpis.pendingDistributionsCount),
      note: pendingNote(kpis.pendingDistributionsCount, kpis.pendingDistributionsXlm),
      source: "TESTNET"
    },
    {
      id: "campaigns",
      label: "Campañas con aporte",
      value: String(kpis.campaignsCount),
      note: campaignsNote(kpis.campaignsCount),
      source: "SIMULADO"
    }
  ];
}
