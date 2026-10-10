"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import type { FavoritePort } from "@/application/ports/favorite-port";

/**
 * Server state of the signed-in investor's favorites (Feature #414, WU4a).
 *
 * The id list lives in SWR under one key, only when a port exists **and** the
 * caller says it is enabled (a public visitor has no favorites). `toggle` writes
 * through the port and then re-reads; a failure keeps the previous state with no
 * optimistic fabrication, and an unauthenticated result is a no-op.
 */

/** Sanitized load failure; the code is already provider-free. */
class FavoritesError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`favorites request failed: ${code}`);
    this.name = "FavoritesError";
    this.code = code;
  }
}

const EMPTY_SET: ReadonlySet<string> = new Set();

async function load(port: FavoritePort): Promise<readonly string[]> {
  const result = await port.list();
  if (!result.ok) throw new FavoritesError(result.code);
  return result.campaignIds;
}

export interface FavoritesState {
  readonly campaignIds: ReadonlySet<string>;
  readonly isLoading: boolean;
  readonly loadFailed: boolean;
  readonly reload: () => void;
  readonly toggle: (campaignId: string) => Promise<void>;
}

export function useFavorites(port: FavoritePort | null, enabled: boolean): FavoritesState {
  const active = port !== null && enabled;
  const { data, error, isLoading, mutate } = useSWR<readonly string[]>(
    active ? ["favorites"] : null,
    () => load(port as FavoritePort),
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );

  const reload = useCallback(() => {
    void mutate();
  }, [mutate]);

  const campaignIds = useMemo<ReadonlySet<string>>(() => (data ? new Set(data) : EMPTY_SET), [data]);

  const toggle = useCallback(
    async (campaignId: string): Promise<void> => {
      if (!active) return;
      const current = data ?? [];
      const isFavorite = current.includes(campaignId);
      const result = isFavorite
        ? await (port as FavoritePort).remove(campaignId)
        : await (port as FavoritePort).add(campaignId);
      // A failure (including unauthenticated) keeps the previous state: the UI
      // never claims a favorite the backend rejected, so there is nothing to
      // roll back and no re-read to run.
      if (!result.ok) return;
      await mutate();
    },
    [active, data, mutate, port]
  );

  return {
    campaignIds,
    isLoading,
    loadFailed: error !== undefined,
    reload,
    toggle
  };
}
