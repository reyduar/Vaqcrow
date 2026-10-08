import type { FavoriteListResult, FavoritePort, FavoriteToggleResult } from "@/application/ports/favorite-port";

/**
 * Null-object favorites port used when no backend base URL is configured: every
 * read and write is the sanitized `unavailable`, so the UI shows its error state
 * instead of an invented empty set.
 */
export const UNAVAILABLE_FAVORITE_PORT: FavoritePort = Object.freeze({
  async list(): Promise<FavoriteListResult> {
    return { ok: false, code: "unavailable" };
  },
  async add(): Promise<FavoriteToggleResult> {
    return { ok: false, code: "unavailable" };
  },
  async remove(): Promise<FavoriteToggleResult> {
    return { ok: false, code: "unavailable" };
  }
});
