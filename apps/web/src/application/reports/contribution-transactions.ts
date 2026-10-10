import type { ReportContributionTransaction } from "@/application/ports/report-port";
import { formatDate, formatXlmAmount } from "./format";

/**
 * «Aportes en el período» of the investor report (#438/WU5, owner decision
 * D3): every observed contribute transaction whose month falls in the selected
 * range — the API already filters by the range, newest first, so this module
 * only formats. Pure and React-free; the explorer URLs are the API's own
 * (`null` without an explorer base). A contribution made before hashes were
 * persisted is not listed. Copy is owner-pending (the template does not draw
 * this table).
 */

export const REPORT_CONTRIBUTIONS_COPY = {
  title: "Aportes en el período",
  empty: "Sin aportes confirmados en el período.",
  date: "Fecha",
  pyme: "PyME",
  amount: "Monto",
  transaction: "Transacción",
  vault: "Bóveda"
} as const;

export interface ContributionTransactionRow {
  readonly date: string;
  readonly pyme: string;
  readonly amount: string;
  readonly transactionHash: string;
  readonly explorerUrl: string | null;
  readonly vaultAddress: string;
  readonly vaultExplorerUrl: string | null;
}

export function toContributionTransactionRows(
  transactions: readonly ReportContributionTransaction[]
): readonly ContributionTransactionRow[] {
  return transactions.map((transaction) => ({
    date: formatDate(transaction.date),
    pyme: transaction.pyme,
    amount: formatXlmAmount(transaction.amountXlm),
    transactionHash: transaction.transactionHash,
    explorerUrl: transaction.explorerUrl,
    vaultAddress: transaction.vaultAddress,
    vaultExplorerUrl: transaction.vaultExplorerUrl
  }));
}
