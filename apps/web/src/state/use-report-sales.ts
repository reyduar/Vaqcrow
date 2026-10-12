"use client";

import { useCallback } from "react";
import useSWR from "swr";
import type { ReportErrorCode, ReportSalesByPyme, ReportSalesPort } from "@/application/ports/report-port";

/**
 * Server state of the "Ventas declaradas por PyME" block (Feature #430, WU2).
 *
 * It is a separate SWR read under `["report-sales", from, to]` on purpose: the
 * block has its own partial-error state and can fail while the rest of the
 * report stays up. A failed read leaves `data` `null` and flips `loadFailed`;
 * nothing is fabricated.
 *
 * `loadErrorCode` (#480) surfaces the sanitized code so the block can tell a
 * genuine failure from a build with no backend configured (`not_configured`).
 */

class ReportSalesError extends Error {
  readonly code: ReportErrorCode;

  constructor(code: ReportErrorCode) {
    super(`report sales request failed: ${code}`);
    this.name = "ReportSalesError";
    this.code = code;
  }
}

async function load(port: ReportSalesPort, from: string | null, to: string | null): Promise<ReportSalesByPyme> {
  const result = await port.get(from, to);
  if (!result.ok) throw new ReportSalesError(result.code);
  return result.sales;
}

export interface ReportSalesState {
  readonly data: ReportSalesByPyme | null;
  readonly isLoading: boolean;
  readonly loadFailed: boolean;
  /** The sanitized failure code (`not_configured` is not a service failure; #480). */
  readonly loadErrorCode: ReportErrorCode | null;
  readonly reload: () => void;
}

export function useReportSales(
  port: ReportSalesPort | null,
  from: string | null,
  to: string | null,
  enabled: boolean
): ReportSalesState {
  const active = port !== null && enabled;
  const { data, error, isLoading, mutate } = useSWR<ReportSalesByPyme>(
    active ? ["report-sales", from, to] : null,
    () => load(port as ReportSalesPort, from, to),
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );

  const reload = useCallback(() => {
    void mutate();
  }, [mutate]);

  const loadErrorCode: ReportErrorCode | null =
    error === undefined ? null : error instanceof ReportSalesError ? error.code : "unavailable";

  return {
    data: data ?? null,
    isLoading,
    loadFailed: error !== undefined,
    loadErrorCode,
    reload
  };
}
