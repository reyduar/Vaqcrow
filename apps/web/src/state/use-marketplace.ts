"use client";

import { useCallback } from "react";
import useSWR from "swr";
import type { MarketplaceCard, MarketplaceErrorCode, MarketplacePort } from "@/application/ports/marketplace-port";

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
  readonly code: MarketplaceErrorCode;

  constructor(code: MarketplaceErrorCode) {
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
  /**
   * The sanitized code behind a failed read, so a screen can tell a genuine
   * failure apart from a build with no backend configured (`not_configured`,
   * #480) and never renders the latter as a service failure.
   */
  readonly loadErrorCode: MarketplaceErrorCode | null;
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

  const loadErrorCode: MarketplaceErrorCode | null =
    error === undefined ? null : error instanceof MarketplaceError ? error.code : "unavailable";

  return {
    items: data ?? EMPTY,
    isLoading,
    loadFailed: error !== undefined,
    loadErrorCode,
    reload
  };
}
