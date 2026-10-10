"use client";

import { useCallback } from "react";
import useSWR from "swr";
import type { InvestorKycPort, InvestorKycStatus } from "@/application/ports/investor-kyc-port";

/**
 * Server state of the signed-in investor's simulated KYC (Feature #422, WU4).
 *
 * The status lives in SWR under one key, only when a port exists **and** the
 * caller says it is enabled (a PYME never fetches it). `approved` is the honest
 * boolean: `false` while the status is unknown or the read failed, which the
 * contribution flow treats as "not yet approved" (the interstitial is
 * simulated, so it never blocks anyone forever). `approve` writes through the
 * port and seeds the cache with the returned status; a failure changes nothing.
 */

/** Sanitized load failure; the code is already provider-free. */
class InvestorKycError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`investor kyc request failed: ${code}`);
    this.name = "InvestorKycError";
    this.code = code;
  }
}

async function load(port: InvestorKycPort): Promise<InvestorKycStatus> {
  const result = await port.get();
  if (!result.ok) throw new InvestorKycError(result.code);
  return result.status;
}

export interface InvestorKycState {
  /** `true` only once a record is confirmed; unknown or failed reads stay `false`. */
  readonly approved: boolean;
  readonly isLoading: boolean;
  /** Records the simulated approval. Resolves `true` when the caller is approved afterwards. */
  readonly approve: () => Promise<boolean>;
}

export function useInvestorKyc(port: InvestorKycPort | null, enabled: boolean): InvestorKycState {
  const active = port !== null && enabled;
  const { data, isLoading, mutate } = useSWR<InvestorKycStatus>(
    active ? ["investor-kyc"] : null,
    () => load(port as InvestorKycPort),
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );

  const approve = useCallback(async (): Promise<boolean> => {
    if (!active) return false;
    const result = await (port as InvestorKycPort).approve();
    if (!result.ok) return false;
    // Seed the cache with the server's own record: no re-read, no fabrication.
    await mutate(result.status, { revalidate: false });
    return result.status.approved;
  }, [active, mutate, port]);

  return {
    approved: data?.approved ?? false,
    isLoading: active && isLoading,
    approve
  };
}
