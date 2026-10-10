/**
 * The per-account favorites capability (Feature #414, WU4a). Vendor-free and
 * React-free: the HTTP adapter lives in `infrastructure/marketplace/`.
 *
 * It mirrors `GET /favorites` plus `PUT`/`DELETE /favorites/:campaignId`. The
 * owner is always the verified principal resolved from the token, so no user id
 * ever travels on the wire or through this boundary.
 *
 * `unauthenticated` is kept apart from `unavailable`: a missing or rejected
 * session is a state the UI can act on, a backend failure is not.
 */

/** Sanitized failure codes; `unauthenticated` covers the API's 401 and 403. */
export type FavoriteErrorCode = "unavailable" | "network" | "unauthenticated";

export type FavoriteListResult =
  | { readonly ok: true; readonly campaignIds: readonly string[] }
  | { readonly ok: false; readonly code: FavoriteErrorCode };

export type FavoriteToggleResult =
  | { readonly ok: true; readonly applied: boolean }
  | { readonly ok: false; readonly code: FavoriteErrorCode };

export interface FavoritePort {
  list(): Promise<FavoriteListResult>;
  /** Adds a favorite; `applied` is the server's resulting boolean. */
  add(campaignId: string): Promise<FavoriteToggleResult>;
  /** Removes a favorite; `applied` is the server's resulting boolean. */
  remove(campaignId: string): Promise<FavoriteToggleResult>;
}
