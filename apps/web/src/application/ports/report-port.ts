import type {
  ReportLatestDistributionState,
  ReportMonthlyPointState,
  ReportSalesByPymeStatus
} from "@vaqcrow/contracts";

/**
 * The investor report capability (Feature #430, WU2). Vendor-free and
 * React-free: the HTTP adapters live in `infrastructure/reports/`.
 *
 * It mirrors the two WU1 endpoints (`GET /reports` and
 * `GET /reports/sales-by-pyme`), which are available to **every authenticated
 * role** and always scope to the verified principal (the API resolves the
 * investor's Stellar account server-side, so no account id or user id crosses
 * this boundary). `from`/`to` are inclusive `YYYY-MM` months; `null`/`null`
 * means "no range supplied", so the API answers its own default window (the
 * last six months up to the investor's last period) together with
 * `availableRange` — that is how the web builds its presets without a
 * hard-coded year.
 *
 * `imageSrc` is deliberately **not** the wire field: the contract keeps
 * `imageUrl` API-relative so it can never leak a signed storage link. The
 * adapter resolves it against the configured API base and this port exposes the
 * resulting **absolute** URL the DOM needs, or `null` when the campaign has no
 * image or the reference cannot be resolved.
 *
 * Money stays a canonical 7-decimal XLM string; this boundary never converts it
 * to a JavaScript number for any arithmetic. `null` is the honest "sin dato"
 * (a missing distribution share, declared sale or pending total) and is never a
 * fabricated `0`.
 */

/** One month of the series, ready to render. */
export interface ReportMonthlyPoint {
  readonly period: string;
  /** `null` exactly for a `none` month — never a fabricated `0.0000000`. */
  readonly amountXlm: string | null;
  readonly state: ReportMonthlyPointState;
}

/** The report's headline figures for the selected range. */
export interface ReportKpis {
  readonly contributedXlm: string;
  readonly confirmedDistributionsXlm: string;
  readonly pendingDistributionsCount: number;
  /** `null` when nothing is pending — an absence, not a zero. */
  readonly pendingDistributionsXlm: string | null;
  readonly campaignsCount: number;
}

/** One recent distribution addressed to the investor. */
export interface ReportLatestDistribution {
  /** Persisted confirmation (or recorded) time, ISO 8601 with offset. */
  readonly date: string;
  readonly pyme: string;
  readonly declaredSalesArs: number | null;
  readonly shareXlm: string | null;
  readonly state: ReportLatestDistributionState;
}

export interface AvailableRange {
  readonly firstPeriod: string | null;
  readonly lastPeriod: string | null;
}

export interface InvestorReport {
  readonly range: { readonly from: string; readonly to: string };
  readonly availableRange: AvailableRange;
  readonly isEmpty: boolean;
  readonly kpis: ReportKpis;
  readonly monthlySeries: readonly ReportMonthlyPoint[];
  readonly latestDistributions: readonly ReportLatestDistribution[];
}

/** One declared-sales row for a PyME the investor holds a position in. */
export interface ReportSalesByPymeEntry {
  readonly name: string;
  readonly sector: string;
  /** Absolute image URL resolved by the adapter from the contract's API-relative `imageUrl`. */
  readonly imageSrc: string | null;
  readonly period: string;
  /** `null` exactly for a `missing` month — never a fabricated zero. */
  readonly salesArs: number | null;
  readonly status: ReportSalesByPymeStatus;
}

/** `GET /reports/sales-by-pyme` read model, fetched on its own. */
export interface ReportSalesByPyme {
  readonly pymes: readonly ReportSalesByPymeEntry[];
}

/** Sanitized failure codes: the session's `unauthenticated` plus the API/transport codes. */
export type ReportErrorCode = "unavailable" | "network" | "unauthenticated";

export type ReportResult =
  | { readonly ok: true; readonly report: InvestorReport }
  | { readonly ok: false; readonly code: ReportErrorCode };

export type ReportSalesResult =
  | { readonly ok: true; readonly sales: ReportSalesByPyme }
  | { readonly ok: false; readonly code: ReportErrorCode };

export interface ReportPort {
  /** `null`/`null` asks the API for its default window; otherwise both bounds are `YYYY-MM`. */
  get(from: string | null, to: string | null): Promise<ReportResult>;
}

export interface ReportSalesPort {
  /** Same range semantics as `ReportPort.get`. */
  get(from: string | null, to: string | null): Promise<ReportSalesResult>;
}
