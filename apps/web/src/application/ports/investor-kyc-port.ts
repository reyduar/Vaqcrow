/**
 * The investor's simulated KYC capability (Feature #422, WU4). Vendor-free and
 * React-free: the HTTP adapter lives in `infrastructure/kyc/`.
 *
 * It mirrors `GET /investor-kyc` and `POST /investor-kyc`. The owner is always
 * the verified principal resolved from the token, so no user id ever travels on
 * the wire or through this boundary. `GET` never fails on a missing record — it
 * answers `approved: false` with a `null` date. `POST` is idempotent.
 *
 * `unauthenticated` is kept apart from `unavailable`: a missing or rejected
 * session is a state the UI can act on, a backend failure is not.
 */

/** Sanitized failure codes; `unauthenticated` covers the API's 401 and 403. */
export type InvestorKycErrorCode = "unavailable" | "network" | "unauthenticated";

export interface InvestorKycStatus {
  readonly approved: boolean;
  /** The approval instant, or `null` when the investor is not yet approved. */
  readonly approvedAt: string | null;
  /** Always `true` in this demo: the result is simulated and labelled as such. */
  readonly simulado: boolean;
}

export type InvestorKycResult =
  | { readonly ok: true; readonly status: InvestorKycStatus }
  | { readonly ok: false; readonly code: InvestorKycErrorCode };

export interface InvestorKycPort {
  get(): Promise<InvestorKycResult>;
  /** Records the simulated approval; idempotent on the server. */
  approve(): Promise<InvestorKycResult>;
}
