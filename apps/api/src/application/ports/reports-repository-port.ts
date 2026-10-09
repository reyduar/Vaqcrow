/**
 * The investor report read model (#430, WU1).
 *
 * Vendor-free: this port lives in `application/` and imports no Fastify,
 * Supabase or Stellar SDK. The report aggregates the investor's own persisted
 * rows — contributions (dated by `coalesce(last_observed_at, created_at)`,
 * because a contribution is a cumulative per-account row with no per-event
 * date), distribution recipient rows (dated by their settled `period`) and the
 * declared monthly sales of the PyMEs the investor holds a position in.
 *
 * Every read is scoped by the `investorAccountId` the caller resolved from the
 * verified principal, so the adapter can only ever read that account's own
 * rows. Records carry only facts persisted from a confirmed ledger read; all
 * unit conversion (stroops -> canonical XLM, staleness bucketing) stays in the
 * application layer.
 */

/** One `campaign_contribution` row: the investor's own cumulative contribution. */
export interface ReportContributionRecord {
  readonly campaignId: string;
  readonly contributionStroops: bigint;
  /** `coalesce(last_observed_at, created_at)` as an ISO datetime. */
  readonly observedAt: string;
}

export type ReportDistributionState = "submitted" | "confirmed" | "failed";

/** One distribution recipient row addressed to the investor. */
export interface ReportDistributionRecord {
  readonly distributionId: string;
  /** `null` for a distribution recorded before the campaign link existed. */
  readonly campaignId: string | null;
  /** The PyME's name, or `null` when the campaign/company cannot be resolved. */
  readonly campaignName: string | null;
  /** The settled `YYYY-MM`; `null` for a legacy distribution. */
  readonly period: string | null;
  /** This recipient's allocation, in stroops. */
  readonly amountStroops: bigint;
  readonly state: ReportDistributionState;
  /** Horizon's ledger close time; `null` for a not-yet-confirmed row. */
  readonly confirmedAt: string | null;
  /** The row's recorded time; always present. */
  readonly recordedAt: string;
  /** The PyME's declared sale for this distribution's period, or `null`. */
  readonly declaredSalesArs: bigint | null;
}

export type ReportSalesStatus = "reported" | "missing" | "anomalous";

/**
 * One declared-sales row for a PyME the investor holds a position in, plus the
 * campaign id used to build the API-relative image path.
 */
export interface ReportSalesByPymeRecord {
  readonly campaignId: string;
  readonly name: string;
  readonly sector: string;
  readonly period: string;
  /** `null` exactly for a `missing` month — an absence, never a zero. */
  readonly salesArs: bigint | null;
  readonly status: ReportSalesStatus;
}

export type ReportsRepositoryError = { readonly code: "unavailable" };

export type ReportsRepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ReportsRepositoryError };

export interface ReportsRepositoryPort {
  /** Every contribution the investor made. */
  listContributions(
    investorAccountId: string
  ): Promise<ReportsRepositoryResult<readonly ReportContributionRecord[]>>;

  /** Every distribution recipient row addressed to the investor. */
  listDistributions(
    investorAccountId: string
  ): Promise<ReportsRepositoryResult<readonly ReportDistributionRecord[]>>;

  /** The declared sales of every PyME the investor holds a position in. */
  listSalesByPyme(
    investorAccountId: string
  ): Promise<ReportsRepositoryResult<readonly ReportSalesByPymeRecord[]>>;
}
