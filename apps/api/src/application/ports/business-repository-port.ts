/**
 * The PyME company boundary (Feature #398, Task #399 / T3b).
 *
 * A company belongs to exactly one owner (`owner_user_id`) and the API is the
 * single enforcement point: `public.businesses` is `service_role`-only with zero
 * RLS policies, so every read the adapter issues is scoped by the authenticated
 * owner the caller resolved from the verified token. The owner is never part of
 * a request body.
 *
 * Plain data only: this port lives in `application/` and must not import
 * Fastify, Supabase, Stellar or LLM SDKs. Amounts cross the boundary as numbers
 * (the demo's goals are well within `Number.MAX_SAFE_INTEGER`).
 */

export interface BusinessDraft {
  readonly name: string;
  readonly cuit: string;
  readonly sector: string;
  readonly city: string;
  readonly description: string;
  /** The financing goal in whole ARS. Always greater than zero. */
  readonly goalArs: number;
  /** The revenue-share percentage, inclusive of 1 and 10. */
  readonly revenueShare: number;
}

export interface BusinessRecord extends BusinessDraft {
  readonly businessId: string;
  readonly ownerUserId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type BusinessRepositoryErrorCode = "not_found" | "invalid_request" | "unavailable";

export interface BusinessRepositoryError {
  readonly code: BusinessRepositoryErrorCode;
}

export type BusinessRepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: BusinessRepositoryError };

export interface BusinessRepositoryPort {
  /**
   * Creates the caller's company. The owner is the verified principal, never a
   * client-supplied id.
   */
  createForOwner(input: {
    readonly ownerUserId: string;
    readonly draft: BusinessDraft;
  }): Promise<BusinessRepositoryResult<BusinessRecord>>;

  /** The caller's own company; `not_found` when it has not registered one yet. */
  findByOwner(ownerUserId: string): Promise<BusinessRepositoryResult<BusinessRecord>>;

  /**
   * The caller's own company by id. Any row that is not owned by `ownerUserId`
   * is `not_found`, never returned — this is the read the sales-feed route uses
   * to scope a PyME to its own business.
   */
  findOwnedById(input: {
    readonly ownerUserId: string;
    readonly businessId: string;
  }): Promise<BusinessRepositoryResult<BusinessRecord>>;
}
