import type { FavoriteRepositoryError, FavoriteRepositoryPort } from "../ports/favorite-repository-port.js";

/**
 * The add/remove favorites use case (#414/WU2).
 *
 * `active: true` saves, `active: false` removes; both are idempotent at the
 * repository, so a replay reports `applied: false` and nothing else changes. An
 * unknown campaign travels through as `not_found`. `userId` is the verified
 * principal the caller passed, never a body value.
 */

export interface SetFavoriteDependencies {
  readonly favorites: Pick<FavoriteRepositoryPort, "add" | "remove">;
}

export interface SetFavoriteInput {
  readonly userId: string;
  readonly campaignId: string;
  readonly active: boolean;
}

export type SetFavoriteResult =
  | { readonly ok: true; readonly value: { readonly campaignId: string; readonly applied: boolean } }
  | { readonly ok: false; readonly error: FavoriteRepositoryError };

export async function setFavorite(
  dependencies: SetFavoriteDependencies,
  input: SetFavoriteInput
): Promise<SetFavoriteResult> {
  const outcome = input.active
    ? await dependencies.favorites.add(input.userId, input.campaignId)
    : await dependencies.favorites.remove(input.userId, input.campaignId);

  if (!outcome.ok) {
    return { ok: false, error: outcome.error };
  }

  return { ok: true, value: { campaignId: input.campaignId, applied: outcome.value.applied } };
}
