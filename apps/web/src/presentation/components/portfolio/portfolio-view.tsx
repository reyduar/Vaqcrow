import { sectorBreakdown } from "@/application/portfolio/sectors";
import { sortPortfolioPositions, type PortfolioSortMode } from "@/application/portfolio/sort";
import { EMPTY_PORTFOLIO_COPY } from "@/application/portfolio/wallet-states";
import type { PortfolioSummary } from "@/application/ports/portfolio-port";
import type { WalletConnectionPort } from "@/application/ports/wallet-connection-port";
import type { WalletPort } from "@/application/ports/wallet-port";
import { microcopy } from "@/application/trust/disclosures";
import { EmptyState } from "../empty-state";
import { PortfolioDistributions } from "./portfolio-distributions";
import { PortfolioPositionAction } from "./portfolio-position-action";
import { PortfolioPositionCard } from "./portfolio-position-card";
import { PortfolioSectorBars } from "./portfolio-sector-bars";
import { PortfolioTotals } from "./portfolio-totals";
import { PortfolioWalletCard, type PortfolioWallet } from "./portfolio-wallet-card";

/**
 * The investor portfolio body (Feature #426, WU2; wallet states #426/WU4): the
 * wallet surface (the connected card, or the connect-mode card when no key is
 * persisted), the stat cards, "Mis aportes en PyMEs" with the sort toggle (or
 * the empty state), "Aportes por sector" and "Distribuciones". Presentational:
 * the load state, the ports, the connect flow and the sort state belong to
 * `portfolio.tsx`.
 */

export type { PortfolioWallet } from "./portfolio-wallet-card";

export interface PortfolioViewProps {
  readonly summary: PortfolioSummary;
  readonly wallet: PortfolioWallet | null;
  /** Freighter signer for the connect-mode card; injectable from the container. */
  readonly walletPort: WalletPort;
  /** Persisted-connection capability for the connect-mode card. */
  readonly connectionPort: WalletConnectionPort;
  /** Re-reads the wallet after a successful connect. */
  readonly onConnected: () => void;
  readonly sort: PortfolioSortMode;
  readonly onSortChange: (mode: PortfolioSortMode) => void;
  readonly onDisconnect: () => void;
  /** Empty-state CTA: navigate to the marketplace. */
  readonly onExplore: () => void;
  /** Refreshes the read once a position's withdraw/refund attempt settled. */
  readonly onActionSubmitted?: () => void;
}

const SORT_OPTIONS: readonly { readonly id: PortfolioSortMode; readonly label: string }[] = [
  { id: "recent", label: "Recientes" },
  { id: "state", label: "Por estado" }
];

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

export function PortfolioView({
  summary,
  wallet,
  walletPort,
  connectionPort,
  onConnected,
  sort,
  onSortChange,
  onDisconnect,
  onExplore,
  onActionSubmitted
}: PortfolioViewProps) {
  // #426/WU4 honesty gate: `GET /portfolio` answers 200 with an empty list when
  // the principal has no persisted `stellar_public_key`, so neither the totals
  // nor an empty read is evidence of anything until a wallet connection is
  // known. Without a connected key the connect-mode card is the whole surface:
  // no totals, no positions or empty state, no sectors, no distributions.
  if (wallet === null) {
    return (
      <div className="flex flex-col gap-10">
        <PortfolioWalletCard
          wallet={null}
          walletPort={walletPort}
          connectionPort={connectionPort}
          onConnected={onConnected}
          onDisconnect={onDisconnect}
        />
      </div>
    );
  }

  const positions = sortPortfolioPositions(summary.contributions, sort);
  const sectors = sectorBreakdown(summary.contributions);
  const hasContributions = summary.contributions.length > 0;

  return (
    <div className="flex flex-col gap-10">
      <div
        className="grid gap-6"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }}
      >
        <div style={{ gridColumn: "span 2" }}>
          <PortfolioWalletCard
            wallet={wallet}
            walletPort={walletPort}
            connectionPort={connectionPort}
            onConnected={onConnected}
            onDisconnect={onDisconnect}
          />
        </div>
        <PortfolioTotals totals={summary.totals} />
      </div>

      <section aria-labelledby="portfolio-positions-heading" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="portfolio-positions-heading" className="m-0 text-[26px] leading-[1.2] font-bold tracking-[-0.02em]">
            Mis aportes en PyMEs
          </h2>
          {positions.length > 0 ? (
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
          ) : null}
        </div>
        {hasContributions ? (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {positions.map((position) => (
              <PortfolioPositionCard
                key={position.campaignId}
                position={position}
                action={
                  <PortfolioPositionAction
                    position={position}
                    {...(onActionSubmitted ? { onActionSubmitted } : {})}
                  />
                }
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            title={EMPTY_PORTFOLIO_COPY.title}
            body={EMPTY_PORTFOLIO_COPY.body}
            action={{ label: EMPTY_PORTFOLIO_COPY.cta, onPress: onExplore }}
          />
        )}
        {/* #438/WU5: the canonical hash note, once for every position's proof row. */}
        {hasContributions ? <p className="m-0 text-xs text-text-secondary">{microcopy.hashTechnicalOnly}</p> : null}
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
