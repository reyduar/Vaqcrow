"use client";

import { useCallback } from "react";
import useSWR from "swr";
import type { ReportSalesByPyme, ReportSalesPort } from "@/application/ports/report-port";

/**
 * Server state of the "Ventas declaradas por PyME" block (Feature #430, WU2).
 *
 * It is a separate SWR read under `["report-sales", from, to]` on purpose: the
 * block has its own partial-error state and can fail while the rest of the
 * report stays up. A failed read leaves `data` `null` and flips `loadFailed`;
 * nothing is fabricated.
 */

class ReportSalesError extends Error {
  readonly code: string;

  constructor(code: string) {
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

  return {
    data: data ?? null,
    isLoading,
    loadFailed: error !== undefined,
    reload
  };
}
