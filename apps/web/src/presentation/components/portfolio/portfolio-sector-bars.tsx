import type { SectorShare } from "@/application/portfolio/sectors";

/**
 * "Aportes por sector" (`Vaqcrow Portafolio.dc.html:186-193`, Feature #426,
 * WU2). Presentational: the rows arrive already aggregated and rounded by
 * `application/portfolio/sectors.ts`.
 */

export interface PortfolioSectorBarsProps {
  readonly rows: readonly SectorShare[];
}

export function PortfolioSectorBars({ rows }: PortfolioSectorBarsProps) {
  return (
    <section aria-labelledby="portfolio-sector-heading" className="flex flex-col gap-4 rounded-card border border-border p-6">
      <h2 id="portfolio-sector-heading" className="m-0 text-[19px] font-bold">
        Aportes por sector
      </h2>
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {rows.map((row, index) => (
          <li key={row.sector} className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm">
              <span>{row.sector}</span>
              <span className="font-[650]">{row.percent} %</span>
            </div>
            <div
              aria-hidden="true"
              className="h-2 overflow-hidden rounded-pill bg-page-surface shadow-[inset_0_0_0_1px_var(--color-page-border)]"
            >
              <div
                className="h-full bg-brand-accent"
                style={{ width: `${row.percent}%`, opacity: Math.max(0.25, 1 - index * 0.25) }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
