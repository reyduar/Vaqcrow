"use client";

import { useCallback } from "react";
import useSWR from "swr";
import type { PortfolioErrorCode, PortfolioPort, PortfolioSummary } from "@/application/ports/portfolio-port";

/**
 * Server state of the investor portfolio (Feature #426, WU2).
 *
 * The whole summary lives in SWR under `["portfolio"]`, keyed only when a port
 * exists **and** the caller says it is enabled (the route is `INVERSOR`-gated
 * upstream, so a null port fetches nothing). A failed read never invents data:
 * `summary` stays `null` and `loadFailed` is the only signal. The controller
 * owns loading and error, never local placeholder data.
 *
 * `loadErrorCode` (#480) surfaces the sanitized code so the controller can tell
 * a genuine failure from a build with no backend configured
 * (`not_configured`), which must never read as a service failure.
 */

/** Sanitized load failure; the code is already provider-free. */
class PortfolioError extends Error {
  readonly code: PortfolioErrorCode;

  constructor(code: PortfolioErrorCode) {
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
  /** The sanitized failure code (`not_configured` is not a service failure; #480). */
  readonly loadErrorCode: PortfolioErrorCode | null;
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

  const loadErrorCode: PortfolioErrorCode | null =
    error === undefined ? null : error instanceof PortfolioError ? error.code : "unavailable";

  return {
    summary: data ?? null,
    isLoading,
    loadFailed: error !== undefined,
    loadErrorCode,
    reload
  };
}
