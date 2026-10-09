import { sectorBreakdown } from "@/application/portfolio/sectors";
import { sortPortfolioPositions, type PortfolioSortMode } from "@/application/portfolio/sort";
import { walletAccountExplorerUrl } from "@/application/pyme-onboarding/wallet-connection";
import type { PortfolioSummary } from "@/application/ports/portfolio-port";
import { WalletCard } from "../wallet-card";
import { PortfolioDistributions } from "./portfolio-distributions";
import { PortfolioPositionCard } from "./portfolio-position-card";
import { PortfolioSectorBars } from "./portfolio-sector-bars";
import { PortfolioTotals } from "./portfolio-totals";

/**
 * The investor portfolio body (Feature #426, WU2): the wallet card (only when a
 * connection key exists), the stat cards, "Mis aportes en PyMEs" with the sort
 * toggle, "Aportes por sector" and "Distribuciones". Presentational: the load
 * state, the ports and the sort state belong to `portfolio.tsx`.
 */

export interface PortfolioWallet {
  readonly publicKey: string;
  readonly frozen: boolean;
  readonly balanceXlm: string | null;
}

export interface PortfolioViewProps {
  readonly summary: PortfolioSummary;
  readonly wallet: PortfolioWallet | null;
  readonly sort: PortfolioSortMode;
  readonly onSortChange: (mode: PortfolioSortMode) => void;
  readonly onDisconnect: () => void;
}

const SORT_OPTIONS: readonly { readonly id: PortfolioSortMode; readonly label: string }[] = [
  { id: "recent", label: "Recientes" },
  { id: "state", label: "Por estado" }
];

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

export function PortfolioView({ summary, wallet, sort, onSortChange, onDisconnect }: PortfolioViewProps) {
  const positions = sortPortfolioPositions(summary.contributions, sort);
  const sectors = sectorBreakdown(summary.contributions);

  return (
    <div className="flex flex-col gap-10">
      <div
        className="grid gap-6"
        style={{ gridTemplateColumns: wallet ? "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" : "1fr" }}
      >
        {wallet ? (
          <div style={{ gridColumn: wallet ? "span 2" : undefined }}>
            <WalletCard
              publicKey={wallet.publicKey}
              frozen={wallet.frozen}
              balanceXlm={wallet.balanceXlm}
              explorerUrl={walletAccountExplorerUrl(wallet.publicKey)}
              onDisconnect={onDisconnect}
            />
          </div>
        ) : null}
        <PortfolioTotals totals={summary.totals} />
      </div>

      <section aria-labelledby="portfolio-positions-heading" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="portfolio-positions-heading" className="m-0 text-[26px] leading-[1.2] font-bold tracking-[-0.02em]">
            Mis aportes en PyMEs
          </h2>
          <div role="group" aria-label="Ordenar" className="flex gap-0.5 rounded-control border border-border bg-page-surface p-[3px]">
            {SORT_OPTIONS.map((option) => {
              const active = sort === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSortChange(option.id)}
                  className={`h-9 cursor-pointer rounded-[7px] px-3 text-[13px] ${
                    active ? "bg-canvas font-[650]" : "bg-transparent font-medium"
                  } ${FOCUS_RING}`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {positions.map((position) => (
            <PortfolioPositionCard key={position.campaignId} position={position} />
          ))}
        </ul>
      </section>

      <div
        className="grid items-start gap-6"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))" }}
      >
        <PortfolioSectorBars rows={sectors} />
        <PortfolioDistributions distributions={summary.distributions} />
      </div>
    </div>
  );
}
