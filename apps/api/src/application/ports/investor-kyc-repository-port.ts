/**
 * Vendor-free persistence port for the investor's simulated KYC (Feature #422,
 * WU4).
 *
 * The investor's identity verification is simulated and auto-approved at the
 * first contribution (owner decision D2). The Supabase implementation reads and
 * writes `public.investor_kyc` as `service_role`; the caller always supplies the
 * `userId` taken from the verified principal, so no user id crosses this
 * boundary from the request. Nothing provider-shaped is returned.
 *
 * `find` distinguishes three outcomes a caller must not conflate: an existing
 * record, a genuine absence (`ok` with `value: null`) and a provider failure
 * (`unavailable`). `approve` is idempotent — a replay reports `created: false`
 * with the existing record, never a duplicate and never an error.
 */

export type InvestorKycError = { readonly code: "unavailable" };

/** A stored KYC record. The owner is the key, so it is not carried here. */
export interface StoredInvestorKyc {
  readonly approvedAt: string;
  readonly simulado: boolean;
}

export type InvestorKycReadResult =
  | { readonly ok: true; readonly value: StoredInvestorKyc | null }
  | { readonly ok: false; readonly error: InvestorKycError };

export type InvestorKycApproveResult =
  | { readonly ok: true; readonly value: StoredInvestorKyc & { readonly created: boolean } }
  | { readonly ok: false; readonly error: InvestorKycError };

export interface InvestorKycRepositoryPort {
  /** The caller's record, or `ok` with `null` when none exists. */
  find(userId: string): Promise<InvestorKycReadResult>;

  /**
   * Records the simulated approval for the caller. Idempotent: when a record
   * already exists it is returned with `created: false`.
   */
  approve(userId: string): Promise<InvestorKycApproveResult>;
}
