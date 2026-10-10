/**
 * The PyME monthly sales-declaration capability (Feature #434, WU3).
 * Vendor-free and React-free: the HTTP adapter lives in
 * `infrastructure/company/`.
 *
 * It mirrors the declared path of `POST /businesses/:businessId/sales-periods`
 * (extended by WU1b): the caller sends exactly the periods it is declaring —
 * whole ARS amounts, or `null` for a month it cannot report (an absence, never
 * a `0`) — and nothing else. The business is chosen by the caller (the id the
 * dashboard resolved for the signed-in PyME); the API still authorizes it
 * against the verified principal, so no owner id or other identity crosses
 * this boundary.
 */

/** One declared month: whole ARS (integer ≥ 0) or `null` for a missing month. */
export interface SalesDeclarationPeriod {
  readonly period: string;
  readonly salesArs: number | null;
}

/**
 * Sanitized failure codes: the session's `unauthenticated` and `not_found`,
 * the API's `invalid_request`/`unavailable`, plus the transport's `network`.
 */
export type SalesDeclarationErrorCode =
  | "invalid_request"
  | "not_found"
  | "unauthenticated"
  | "unavailable"
  | "network";

export type SalesDeclarationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: SalesDeclarationErrorCode };

export interface SalesDeclarationPort {
  /** Declares `periods` for `businessId`; the caller never sends an identity. */
  declare(
    businessId: string,
    periods: readonly SalesDeclarationPeriod[]
  ): Promise<SalesDeclarationResult>;
}
