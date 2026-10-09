import { formatXlmAmount } from "@/application/portfolio/format";
import { PORTFOLIO_DISTRIBUTION_STATE_COPY } from "@/application/portfolio/distribution-state";
import type { PortfolioDistribution } from "@/application/ports/portfolio-port";
import { Badge } from "../badge";

/**
 * "Distribuciones" (`Vaqcrow Portafolio.dc.html:196-204`, Feature #426, WU2).
 * Presentational: `campaignName`/`period` are nullable for a legacy
 * distribution, so the `·` separator is skipped when either is absent and
 * nothing is invented.
 */

export interface PortfolioDistributionsProps {
  readonly distributions: readonly PortfolioDistribution[];
}

function distributionDetail(distribution: PortfolioDistribution): string {
  return [distribution.campaignName, distribution.period].filter((part): part is string => part !== null).join(" · ");
}

export function PortfolioDistributions({ distributions }: PortfolioDistributionsProps) {
  return (
    <section aria-labelledby="portfolio-distributions-heading" className="flex flex-col gap-4 rounded-card border border-border p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 id="portfolio-distributions-heading" className="m-0 text-[19px] font-bold">
          Distribuciones
        </h2>
        <Badge variant="simulado" label="SIMULADO" lang="es" />
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {distributions.map((distribution) => {
          const detail = distributionDetail(distribution);
          return (
            <li
              key={distribution.distributionId}
              className="flex items-center gap-3 rounded-control bg-page-surface px-3.5 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold">{formatXlmAmount(distribution.amountXlm)}</div>
                {detail ? <div className="text-[13px] text-text-secondary">{detail}</div> : null}
              </div>
              <span className="text-xs font-[650]">{PORTFOLIO_DISTRIBUTION_STATE_COPY[distribution.status]}</span>
            </li>
          );
        })}
      </ul>
      <p className="m-0 text-xs text-text-secondary">Cálculo determinístico; la IA no calcula esta obligación.</p>
    </section>
  );
}
