import { Link } from "@heroui/react";
import { formatXlmAmount } from "@/application/portfolio/format";
import { PORTFOLIO_STATUS_COPY, positionStatusBody } from "@/application/portfolio/status";
import type { PortfolioPosition } from "@/application/ports/portfolio-port";
import { Badge } from "../badge";
import { ProgressBar } from "../progress-bar";

/**
 * One position in "Mis aportes en PyMEs" (`Vaqcrow Portafolio.dc.html:154-180`,
 * Feature #426, WU2). Presentational only: the contract's API-relative
 * `imageUrl` is already an absolute `imageSrc` at this boundary. The status
 * block renders the shared label plus, only for `funding`, the template's body
 * parameterized with the real close date; `settled`/`refunding` show the label
 * alone (their bodies reference facts the demo does not persist).
 */

const STATUS_BLOCK_CLASS: Readonly<Record<PortfolioPosition["status"], string>> = {
  funding: "bg-trust-info-surface text-trust-info",
  settled: "bg-page-surface text-text-secondary",
  refunding: "bg-trust-caution-surface text-trust-caution"
};

export interface PortfolioPositionCardProps {
  readonly position: PortfolioPosition;
}

export function PortfolioPositionCard({ position }: PortfolioPositionCardProps) {
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
        <Link
          href={`/campaigns/${position.campaignId}`}
          aria-label={`Ver campaña ${position.name}`}
          className="inline-flex h-11 items-center rounded-control bg-text-primary px-3.5 text-sm font-semibold text-canvas"
        >
          Ver campaña
        </Link>
      </div>
    </li>
  );
}
