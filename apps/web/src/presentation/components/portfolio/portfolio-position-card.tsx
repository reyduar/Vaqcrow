import { Link } from "@heroui/react";
import type { ReactNode } from "react";
import { formatShortAddress } from "@/application/company/format";
import { formatXlmAmount } from "@/application/portfolio/format";
import { PORTFOLIO_PROOF_COPY, toPositionTransactionRows, unhashedContributionLine } from "@/application/portfolio/proofs";
import { PORTFOLIO_STATUS_COPY, positionStatusBody } from "@/application/portfolio/status";
import type { PortfolioPosition } from "@/application/ports/portfolio-port";
import { Badge } from "../badge";
import { ExplorerProof } from "../explorer-proof";
import { ProgressBar } from "../progress-bar";

/**
 * One position in "Mis aportes en PyMEs" (`Vaqcrow Portafolio.dc.html:154-180`,
 * Feature #426, WU2). Presentational only: the contract's API-relative
 * `imageUrl` is already an absolute `imageSrc` at this boundary. The status
 * block renders the shared label plus, only for `funding`, the template's body
 * parameterized with the real close date; `settled`/`refunding` show the label
 * alone (their bodies reference facts the demo does not persist).
 *
 * The Testnet proof row (#438/WU5, owner decision D3) spans the card: the vault
 * with its explorer link and the investor's own observed contribute
 * transactions (amount, day, hash + link), in the template's compact contract
 * row (`ExplorerProof`). With no hashed transaction the hash proof reads «Sin
 * dato»; when hashed transactions cover only part of the contribution, they are
 * listed with one line naming the earlier, unhashed remainder — never a zero.
 * A `null` explorer URL shows the value without a link.
 */

function PositionProof({ position }: { readonly position: PortfolioPosition }) {
  const rows = toPositionTransactionRows(position);
  const unhashed = unhashedContributionLine(position);
  const listId = `position-transactions-${position.campaignId}`;
  return (
    <div className="flex min-w-0 flex-col gap-3 border-t border-border pt-4 sm:col-span-4">
      <ExplorerProof
        label={PORTFOLIO_PROOF_COPY.vault}
        value={position.vaultAddress}
        displayValue={formatShortAddress(position.vaultAddress)}
        explorerUrl={position.vaultExplorerUrl}
        proofLabel={`${PORTFOLIO_PROOF_COPY.vault} de ${position.name}`}
      />
      {rows.length === 0 ? (
        <ExplorerProof label={PORTFOLIO_PROOF_COPY.transactionHash} value={null} explorerUrl={null} />
      ) : (
        <div className="flex flex-col gap-2">
          <span id={listId} className="text-sm text-text-secondary">
            {PORTFOLIO_PROOF_COPY.transactionsTitle}
          </span>
          <ul aria-labelledby={listId} className="m-0 flex list-none flex-col gap-2 p-0">
            {rows.map((row) => (
              <li
                key={row.transactionHash}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-control bg-page-surface px-3.5 py-2.5 text-[13px]"
              >
                <span className="font-[650]">{row.amount}</span>
                <span className="text-text-secondary">{row.date}</span>
                <ExplorerProof
                  label={PORTFOLIO_PROOF_COPY.transactionHash}
                  hideLabel
                  value={row.transactionHash}
                  explorerUrl={row.explorerUrl}
                />
              </li>
            ))}
          </ul>
          {unhashed === null ? null : <span className="text-[13px] text-text-secondary">{unhashed}</span>}
        </div>
      )}
    </div>
  );
}

const STATUS_BLOCK_CLASS: Readonly<Record<PortfolioPosition["status"], string>> = {
  funding: "bg-trust-info-surface text-trust-info",
  settled: "bg-page-surface text-text-secondary",
  refunding: "bg-trust-caution-surface text-trust-caution"
};

export interface PortfolioPositionCardProps {
  readonly position: PortfolioPosition;
  /**
   * Optional action slot for the card's trailing column (Feature #426, WU3):
   * the container composes `PortfolioPositionAction` here. The card stays
   * presentational — it renders whatever node it is handed.
   */
  readonly action?: ReactNode;
}

export function PortfolioPositionCard({ position, action }: PortfolioPositionCardProps) {
  const body = positionStatusBody(position.status, position.closeDate);

  return (
    <li className="grid items-center gap-5 rounded-card border border-border p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
      <div className="flex min-w-0 items-center gap-4">
        <div className="aspect-[16/10] w-[96px] shrink-0 overflow-hidden rounded-control border border-border bg-page-surface">
          {position.imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- an API-proxied bytes endpoint; next/image would need remote-pattern config.
            <img src={position.imageSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <div aria-hidden="true" className="h-full w-full bg-page-surface" />
          )}
        </div>
        <div className="min-w-0">
          <h3 className="m-0 text-[17px] leading-[1.3] font-bold">{position.name}</h3>
          <div className="text-[13px] text-text-secondary">
            {position.sector} · {position.city}
          </div>
          <div className="mt-1">
            <Badge variant="simulado" label="SIMULADO" lang="es" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-text-secondary">Mi aporte</span>
        <span className="text-lg font-bold">{formatXlmAmount(position.contributionXlm)}</span>
      </div>

      <div className="min-w-0">
        <ProgressBar
          label={`Progreso de ${position.name}`}
          value={position.fundedPercentBps}
          goal={10_000}
          formatValue={(value) => `${Math.round(value / 100)} % de la meta`}
        />
      </div>

      <div className="flex flex-col items-end gap-3">
        <div className={`flex w-full max-w-[280px] flex-col gap-0.5 rounded-control p-2.5 text-[13px] ${STATUS_BLOCK_CLASS[position.status]}`}>
          <strong className="font-[650]">{PORTFOLIO_STATUS_COPY[position.status]}</strong>
          {body ? <span className="leading-[1.4]">{body}</span> : null}
        </div>
        {action ? <div className="w-full">{action}</div> : null}
        <Link
          href={`/campaigns/${position.campaignId}`}
          aria-label={`Ver campaña ${position.name}`}
          className="inline-flex h-11 items-center rounded-control bg-text-primary px-3.5 text-sm font-semibold text-canvas"
        >
          Ver campaña
        </Link>
      </div>

      <PositionProof position={position} />
    </li>
  );
}
