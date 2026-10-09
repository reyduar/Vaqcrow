import type {
  CampaignDetailAssessment,
  CampaignDetailDecision,
  CampaignDetailSalesEvidence,
  CampaignDetailStatus,
  RiskBand
} from "@vaqcrow/contracts";

/**
 * The account-gated campaign detail capability (Feature #422, WU2). Vendor-free
 * and React-free: the HTTP adapter lives in `infrastructure/campaign/`.
 *
 * It mirrors `GET /marketplace/campaigns/:campaignId` — a session-gated read of
 * one **published** campaign, the same publication rule as the #414 marketplace
 * listing. No PyME PII crosses this boundary (no owner id, cuit, documents or
 * email); the one person-shaped field is the human-decision `actor`, the admin
 * display name the template renders ("Esta decisión la registra una persona").
 * Every field the template renders but the demo does not persist (`vaultAddress`
 * when absent, the assessment or the decision before they exist) is `null`: the
 * honest "sin dato", never an invented value and never a fabricated zero.
 *
 * `imageSrc` is deliberately **not** the wire field: the contract keeps
 * `imageUrl` API-relative (`/marketplace/campaigns/<id>/image`) so a signed
 * storage link can never leak. The adapter resolves it against the configured
 * API base and this port exposes the resulting **absolute** URL the DOM needs,
 * or `null` when the campaign has no image.
 */

/** One campaign's public detail, ready to render. */
export interface CampaignDetail {
  readonly campaignId: string;
  readonly name: string;
  readonly sector: string;
  readonly city: string;
  /** `businesses.description`, the page's tagline copy. */
  readonly description: string;
  readonly foundedAt: string;
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
  /** The derived lifecycle status: `funding` | `settled` | `refunding`. */
  readonly status: CampaignDetailStatus;
  /** How many distinct investors have contributed. */
  readonly backers: number;
  readonly vaultAddress: string | null;
  readonly assessment: CampaignDetailAssessment | null;
  readonly decision: CampaignDetailDecision | null;
  /**
   * The PyME's persisted sales evidence, or `null`/absent when the business has
   * none persisted yet — the honest "sin dato", never an invented series. A
   * missing month carries `salesArs: null`, never a fabricated `0`. Optional so
   * a pre-existing fixture that predates this field stays valid; the HTTP
   * gateway always sets it.
   */
  readonly salesEvidence?: CampaignDetailSalesEvidence | null;
}

/**
 * Sanitized failure codes: the API's `unavailable`/`not_found` envelopes plus
 * the transport's `network` and the session's `unauthenticated` (401/403).
 * `unauthenticated` is kept apart from `unavailable`: a rejected session is a
 * state the UI can act on, a backend failure is not.
 */
export type CampaignDetailErrorCode = "unavailable" | "network" | "unauthenticated" | "not_found";

export type CampaignDetailResult =
  | { readonly ok: true; readonly detail: CampaignDetail }
  | { readonly ok: false; readonly code: CampaignDetailErrorCode };

export interface CampaignDetailPort {
  get(campaignId: string): Promise<CampaignDetailResult>;
}
