import type { FavoriteRepositoryPort } from "../ports/favorite-repository-port.js";

/**
 * The per-account favorites list use case (#414/WU2).
 *
 * The caller's `userId` always comes from the verified principal, never from a
 * body or query, so a caller can only ever read its own rows. A repository
 * failure is `unavailable` — never an empty-but-successful list, which would
 * tell the user they have no favorites when the lookup actually broke.
 */

export interface ListFavoritesDependencies {
  readonly favorites: Pick<FavoriteRepositoryPort, "listCampaignIds">;
}

export type ListFavoritesResult =
  | { readonly ok: true; readonly value: { readonly campaignIds: readonly string[] } }
  | { readonly ok: false; readonly error: { readonly code: "unavailable" } };

export async function listFavorites(
  dependencies: ListFavoritesDependencies,
  userId: string
): Promise<ListFavoritesResult> {
  const listed = await dependencies.favorites.listCampaignIds(userId);

  if (!listed.ok) {
    return { ok: false, error: { code: "unavailable" } };
  }

  return { ok: true, value: { campaignIds: listed.value } };
}
