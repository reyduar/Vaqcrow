"use client";

import { useCallback } from "react";
import useSWR from "swr";
import type { MarketplaceCard, MarketplacePort } from "@/application/ports/marketplace-port";

/**
 * Server state of the Explorar PyMEs marketplace (Feature #414, WU4a).
 *
 * The whole unpaginated list lives in SWR under one key; a `null` port (no
 * backend configured) fetches nothing. A failed read never invents data: `items`
 * stays empty and `loadFailed` is the only signal. The list is not sorted or
 * filtered here — `application/marketplace/filters.ts` is pure and the UI owns
 * that state.
 */

/** Sanitized load failure; the code is already provider-free. */
class MarketplaceError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`marketplace request failed: ${code}`);
    this.name = "MarketplaceError";
    this.code = code;
  }
}

const EMPTY: readonly MarketplaceCard[] = Object.freeze([]);

async function load(port: MarketplacePort): Promise<readonly MarketplaceCard[]> {
  const result = await port.list();
  if (!result.ok) throw new MarketplaceError(result.code);
  return result.items;
}

export interface MarketplaceState {
  readonly items: readonly MarketplaceCard[];
  readonly isLoading: boolean;
  readonly loadFailed: boolean;
  readonly reload: () => void;
}

export function useMarketplace(port: MarketplacePort | null): MarketplaceState {
  const { data, error, isLoading, mutate } = useSWR<readonly MarketplaceCard[]>(
    port ? ["marketplace-campaigns"] : null,
    () => load(port as MarketplacePort),
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );

  const reload = useCallback(() => {
    void mutate();
  }, [mutate]);

  return {
    items: data ?? EMPTY,
    isLoading,
    loadFailed: error !== undefined,
    reload
  };
}
