"use client";

import { useCallback } from "react";
import useSWR from "swr";
import type { PortfolioPort, PortfolioSummary } from "@/application/ports/portfolio-port";

/**
 * Server state of the investor portfolio (Feature #426, WU2).
 *
 * The whole summary lives in SWR under `["portfolio"]`, keyed only when a port
 * exists **and** the caller says it is enabled (the route is `INVERSOR`-gated
 * upstream, so a null port fetches nothing). A failed read never invents data:
 * `summary` stays `null` and `loadFailed` is the only signal. The controller
 * owns loading and error, never local placeholder data.
 */

/** Sanitized load failure; the code is already provider-free. */
class PortfolioError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`portfolio request failed: ${code}`);
    this.name = "PortfolioError";
    this.code = code;
  }
}

async function load(port: PortfolioPort): Promise<PortfolioSummary> {
  const result = await port.get();
  if (!result.ok) throw new PortfolioError(result.code);
  return result.summary;
}

export interface PortfolioState {
  readonly summary: PortfolioSummary | null;
  readonly isLoading: boolean;
  readonly loadFailed: boolean;
  readonly reload: () => void;
}

export function usePortfolio(port: PortfolioPort | null, enabled: boolean): PortfolioState {
  const active = port !== null && enabled;
  const { data, error, isLoading, mutate } = useSWR<PortfolioSummary>(
    active ? ["portfolio"] : null,
    () => load(port as PortfolioPort),
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );

  const reload = useCallback(() => {
    void mutate();
  }, [mutate]);

  return {
    summary: data ?? null,
    isLoading,
    loadFailed: error !== undefined,
    reload
  };
}
