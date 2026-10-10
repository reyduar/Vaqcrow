import type { RiskBand } from "@vaqcrow/contracts";

/**
 * The public marketplace capability (Feature #414, WU4a). Vendor-free and
 * React-free: the HTTP adapter lives in `infrastructure/marketplace/`.
 *
 * It mirrors `GET /marketplace/campaigns` — a public, unpaginated list of
 * published campaigns. Only public PyME facts cross this boundary; there is no
 * owner id, no document and no PII.
 *
 * `imageSrc` is deliberately **not** the wire field: the contract keeps
 * `imageUrl` API-relative (`/marketplace/campaigns/<id>/image`) so it can never
 * leak a signed storage link. The adapter resolves it against the configured
 * API base and this port exposes the resulting **absolute** URL the DOM needs,
 * or `null` when the campaign has no image. A missing value is never rendered
 * as a placeholder from here; the caller owns that decision.
 */

/** One marketplace card, ready to render. */
export interface MarketplaceCard {
  readonly campaignId: string;
  readonly name: string;
  readonly sector: string;
  readonly city: string;
  readonly goalArs: number;
  /** Snapshot conversion of the raised total; `null` when the campaign predates it. */
  readonly raisedArs: number | null;
  /** Funded percentage in basis points, `0..10000`. */
  readonly fundedPercentBps: number;
  readonly revenueShare: number;
  readonly riskBand: RiskBand | null;
  readonly riskConfidence: number | null;
  readonly closeDate: string;
  /** Absolute image URL resolved by the adapter from the contract's API-relative `imageUrl`. */
  readonly imageSrc: string | null;
}

/** Sanitized failure codes: the API's `unavailable` envelope plus the transport's `network`. */
export type MarketplaceErrorCode = "unavailable" | "network";

export type MarketplaceListResult =
  | { readonly ok: true; readonly items: readonly MarketplaceCard[] }
  | { readonly ok: false; readonly code: MarketplaceErrorCode };

export interface MarketplacePort {
  list(): Promise<MarketplaceListResult>;
}
