import type {
  MyCampaignDistributionState,
  MyCampaignSalesStatus,
  MyCampaignState
} from "@vaqcrow/contracts";

/**
 * The PyME «Mi campaña» capability (Feature #434, WU2). Vendor-free and
 * React-free: the HTTP adapter lives in `infrastructure/company/`.
 *
 * It mirrors `GET /my-campaigns` — `PYME`-only, and its caller is always the
 * verified principal (the API scopes every read to the owner server-side, so no
 * owner id, user id or other caller-supplied identity crosses this boundary).
 *
 * `imageSrc` is deliberately **not** the wire field: the contract keeps
 * `imageUrl` API-relative so it can never leak a signed storage link. The
 * adapter resolves it against the configured API base and this port exposes the
 * resulting **absolute** URL the DOM needs, or `null` when the campaign has no
 * image or the reference cannot be resolved.
 *
 * Money stays a server-aggregated figure: the ARS amounts are integer ARS and
 * the XLM amounts are canonical seven-decimal strings. This boundary never
 * converts ARS to XLM — the conversion, when it exists, is the endpoint's own
 * synthetic rate and is labelled `SIMULADO` in the UI. `null` is the honest
 * «Sin dato» (a missing distribution amount, a `missing` sales month or a
 * campaign without an FX snapshot) and is never a fabricated zero.
 */

/** One distribution the campaign paid out, ready to render. */
export interface MyCampaignDistribution {
  readonly distributionId: string;
  /** The settled `YYYY-MM`; `null` for a legacy distribution. */
  readonly period: string | null;
  readonly amountArs: number | null;
  readonly amountXlm: string | null;
  readonly state: MyCampaignDistributionState;
}

/** One declared-sales month of the campaign's PyME. */
export interface MyCampaignSalesMonth {
  readonly period: string;
  /** `null` exactly for a `missing` month — an absence, never a zero. */
  readonly salesArs: number | null;
  readonly status: MyCampaignSalesStatus;
}

/** One campaign the caller owns, with its dashboard fields. */
export interface MyCampaign {
  readonly campaignId: string;
  readonly name: string;
  readonly sector: string;
  readonly city: string;
  /** Absolute image URL resolved by the adapter from the contract's API-relative `imageUrl`. */
  readonly imageSrc: string | null;
  readonly vaultAddress: string;
  readonly state: MyCampaignState;
  readonly goalArs: number;
  /** The raised total in ARS, or `null` when the campaign predates its snapshot. */
  readonly raisedArs: number | null;
  readonly fundedPercentBps: number;
  readonly deadline: string;
  readonly contributorsCount: number;
  readonly distributions: readonly MyCampaignDistribution[];
  readonly sales: readonly MyCampaignSalesMonth[];
}

/** `GET /my-campaigns` read model: every campaign the caller owns (D3). */
export interface MyCampaigns {
  readonly campaigns: readonly MyCampaign[];
}

/** Sanitized failure codes: the session's `unauthenticated` plus the API/transport codes. */
export type MyCampaignsErrorCode = "unavailable" | "network" | "unauthenticated";

export type MyCampaignsResult =
  | { readonly ok: true; readonly myCampaigns: MyCampaigns }
  | { readonly ok: false; readonly code: MyCampaignsErrorCode };

export interface MyCampaignsPort {
  get(): Promise<MyCampaignsResult>;
}
