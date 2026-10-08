/**
 * Vendor-free per-account favorites port (#414/WU2).
 *
 * Favorites persist per signed-in user (owner decision D1); the Supabase
 * implementation reads/writes `public.campaign_favorite` as `service_role` and
 * the caller always supplies the `userId` taken from the verified principal.
 * Nothing provider-shaped crosses this boundary.
 *
 * `add` is idempotent: a replay is `ok` with `applied: false`, never an error.
 * `remove` reports `applied: false` when nothing was deleted. An unknown
 * campaign is `not_found` (the FK violation); every other provider failure is
 * `unavailable`, sanitized at the adapter.
 */

export type FavoriteRepositoryError = { readonly code: "unavailable" } | { readonly code: "not_found" };

export type FavoriteRepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: FavoriteRepositoryError };

export interface FavoriteRepositoryPort {
  /** Every campaign id the caller has saved. */
  listCampaignIds(userId: string): Promise<FavoriteRepositoryResult<readonly string[]>>;

  /** Saves a favorite. `applied` is false when it was already saved. */
  add(userId: string, campaignId: string): Promise<FavoriteRepositoryResult<{ readonly applied: boolean }>>;

  /** Removes a favorite. `applied` is false when it was not saved. */
  remove(userId: string, campaignId: string): Promise<FavoriteRepositoryResult<{ readonly applied: boolean }>>;
}
