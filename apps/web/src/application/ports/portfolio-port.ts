import type { PortfolioPositionStatus, RevenueShareDistributionState } from "@vaqcrow/contracts";

/**
 * The investor portfolio capability (Feature #426, WU2). Vendor-free and
 * React-free: the HTTP adapter lives in `infrastructure/portfolio/`.
 *
 * It mirrors `GET /portfolio` — `INVERSOR`-only, and its caller is always the
 * verified principal (the API resolves the investor's Stellar account
 * server-side, so no account id or user id crosses this boundary).
 *
 * `imageSrc` is deliberately **not** the wire field: the contract keeps
 * `imageUrl` API-relative so it can never leak a signed storage link. The
 * adapter resolves it against the configured API base and this port exposes the
 * resulting **absolute** URL the DOM needs, or `null` when the campaign has no
 * image or the reference cannot be resolved.
 *
 * Money stays a canonical 7-decimal XLM string; this boundary never converts it
 * to a JavaScript number for any arithmetic. `totalDistributionsXlm` is `null`
 * (the honest "sin dato") when nothing has been confirmed yet, never a
 * fabricated `0.0000000`.
 */

/** One campaign the investor contributed to, ready to render. */
export interface PortfolioPosition {
  readonly campaignId: string;
  readonly name: string;
  readonly sector: string;
  readonly city: string;
  /** Absolute image URL resolved by the adapter from the contract's API-relative `imageUrl`. */
  readonly imageSrc: string | null;
  /** The investor's own confirmed contribution, canonical XLM (7 decimals). */
  readonly contributionXlm: string;
  /** The campaign's raised total in ARS, or `null` when it predates its snapshot. */
  readonly raisedArs: number | null;
  readonly goalArs: number;
  readonly fundedPercentBps: number;
  readonly status: PortfolioPositionStatus;
  readonly closeDate: string;
  readonly vaultAddress: string;
  /** The vault's explorer link built by the API; `null` without an explorer base (#438/WU5). */
  readonly vaultExplorerUrl: string | null;
  /**
   * The investor's own observed contribute transactions to this campaign,
   * oldest first. Empty for a contribution made before hashes were persisted —
   * the honest "sin dato", never an invented hash.
   */
  readonly transactions: readonly PortfolioContributionTransaction[];
}

/** One observed contribute transaction: its hash, own amount (canonical XLM) and explorer link. */
export interface PortfolioContributionTransaction {
  readonly transactionHash: string;
  readonly amountXlm: string;
  readonly observedAt: string;
  readonly explorerUrl: string | null;
}

/** One revenue-share distribution the investor is a recipient of. */
export interface PortfolioDistribution {
  readonly distributionId: string;
  readonly campaignId: string | null;
  readonly campaignName: string | null;
  readonly period: string | null;
  /** This recipient's allocation, canonical XLM (7 decimals). */
  readonly amountXlm: string;
  readonly status: RevenueShareDistributionState;
  /** The distribution's Testnet hash (never null: the persisted column is `not null`). */
  readonly transactionHash: string;
  readonly explorerUrl: string | null;
}

export interface PortfolioTotals {
  readonly totalContributedXlm: string;
  /** `null` when nothing has been confirmed yet — never a fabricated zero. */
  readonly totalDistributionsXlm: string | null;
  readonly campaignCount: number;
}

export interface PortfolioSummary {
  readonly contributions: readonly PortfolioPosition[];
  readonly distributions: readonly PortfolioDistribution[];
  readonly totals: PortfolioTotals;
}

/** Sanitized failure codes: the session's `unauthenticated` plus the API/transport codes. */
export type PortfolioErrorCode = "unavailable" | "network" | "unauthenticated";

export type PortfolioResult =
  | { readonly ok: true; readonly summary: PortfolioSummary }
  | { readonly ok: false; readonly code: PortfolioErrorCode };

export interface PortfolioPort {
  get(): Promise<PortfolioResult>;
}
