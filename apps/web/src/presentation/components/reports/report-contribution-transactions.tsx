import { formatShortAddress } from "@/application/company/format";
import {
  REPORT_CONTRIBUTIONS_COPY,
  toContributionTransactionRows
} from "@/application/reports/contribution-transactions";
import type { ReportContributionTransaction } from "@/application/ports/report-port";
import { microcopy } from "@/application/trust/disclosures";
import { Badge } from "../badge";
import { ExplorerProof } from "../explorer-proof";

/**
 * «Aportes en el período» (#438/WU5, owner decision D3): the investor's
 * observed contribute transactions in the selected range — the API already
 * filtered them — each with its Testnet hash and the vault it went to, linked
 * to the explorer when the API sent a URL. The template does not draw this
 * table; it reuses «Últimas distribuciones»' card and table rhythm
 * (`Vaqcrow Informes.dc.html`), the TESTNET badge and the compact contract row
 * («CDLZ…7Q4K Explorador», `Vaqcrow Sistema.dc.html`). The canonical hash note
 * is stated once for the section. Presentational: rows come from
 * `application/reports/contribution-transactions.ts`.
 */
export interface ReportContributionTransactionsProps {
  readonly transactions: readonly ReportContributionTransaction[];
  readonly className?: string;
}

const CELL = "border-b border-border py-[14px] pr-4";
const HEAD = `${CELL} text-left text-xs font-semibold text-text-secondary`;

export function ReportContributionTransactions({ transactions, className }: ReportContributionTransactionsProps) {
  const rows = toContributionTransactionRows(transactions);

  return (
    <section
      aria-labelledby="report-contributions-heading"
      className={`flex flex-col gap-3 overflow-x-auto rounded-card border border-border p-6 ${className ?? ""}`.trim()}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="report-contributions-heading" className="m-0 text-[19px] font-bold">
          {REPORT_CONTRIBUTIONS_COPY.title}
        </h2>
        <Badge variant="testnet" label={microcopy.testnetBadge} lang="es" />
      </div>
      {rows.length === 0 ? (
        <p className="m-0 text-sm text-text-secondary">{REPORT_CONTRIBUTIONS_COPY.empty}</p>
      ) : (
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className={HEAD}>{REPORT_CONTRIBUTIONS_COPY.date}</th>
              <th scope="col" className={HEAD}>{REPORT_CONTRIBUTIONS_COPY.pyme}</th>
              <th scope="col" className={`${CELL} text-right text-xs font-semibold text-text-secondary`}>
                {REPORT_CONTRIBUTIONS_COPY.amount}
              </th>
              <th scope="col" className={HEAD}>{REPORT_CONTRIBUTIONS_COPY.transaction}</th>
              <th scope="col" className={HEAD}>{REPORT_CONTRIBUTIONS_COPY.vault}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.transactionHash}>
                <td className={`${CELL} whitespace-nowrap`}>{row.date}</td>
                <th scope="row" className={`${CELL} text-left font-[650]`}>
                  {row.pyme}
                </th>
                <td className={`${CELL} whitespace-nowrap text-right font-[650]`}>{row.amount}</td>
                <td className={CELL}>
                  <ExplorerProof
                    label="Hash de la transacción"
                    hideLabel
                    value={row.transactionHash}
                    explorerUrl={row.explorerUrl}
                    className="flex-nowrap"
                  />
                </td>
                <td className={CELL}>
                  <ExplorerProof
                    label={REPORT_CONTRIBUTIONS_COPY.vault}
                    hideLabel
                    value={row.vaultAddress}
                    displayValue={formatShortAddress(row.vaultAddress)}
                    explorerUrl={row.vaultExplorerUrl}
                    proofLabel={`${REPORT_CONTRIBUTIONS_COPY.vault} de ${row.pyme}`}
                    className="flex-nowrap"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length > 0 ? <p className="m-0 text-xs text-text-secondary">{microcopy.hashTechnicalOnly}</p> : null}
    </section>
  );
}
