"use client";

import { useCallback } from "react";
import useSWR from "swr";
import type { InvestorReport, ReportPort } from "@/application/ports/report-port";

/**
 * Server state of the investor report (Feature #430, WU2).
 *
 * The whole report lives in SWR under `["report", from, to]`, keyed only when a
 * port exists **and** the caller says it is enabled. A `null`/`null` range is a
 * valid key: it asks the API for its own default window (last six months up to
 * the investor's last period) together with `availableRange`. A failed read
 * never invents data: `data` stays `null` and `loadFailed` is the only signal —
 * the controller owns loading and error.
 */

/** Sanitized load failure; the code is already provider-free. */
class InvestorReportError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`report request failed: ${code}`);
    this.name = "InvestorReportError";
    this.code = code;
  }
}

async function load(port: ReportPort, from: string | null, to: string | null): Promise<InvestorReport> {
  const result = await port.get(from, to);
  if (!result.ok) throw new InvestorReportError(result.code);
  return result.report;
}

export interface InvestorReportState {
  readonly data: InvestorReport | null;
  readonly isLoading: boolean;
  readonly loadFailed: boolean;
  readonly reload: () => void;
}

export function useInvestorReport(
  port: ReportPort | null,
  from: string | null,
  to: string | null,
  enabled: boolean
): InvestorReportState {
  const active = port !== null && enabled;
  const { data, error, isLoading, mutate } = useSWR<InvestorReport>(
    active ? ["report", from, to] : null,
    () => load(port as ReportPort, from, to),
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
