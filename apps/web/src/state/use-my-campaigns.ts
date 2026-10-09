"use client";

import { useCallback } from "react";
import useSWR from "swr";
import type { MyCampaigns, MyCampaignsPort } from "@/application/ports/my-campaigns-port";

/**
 * Server state of the PyME «Mi campaña» dashboard (Feature #434, WU2).
 *
 * The whole read model lives in SWR under `["my-campaigns"]`, keyed only when a
 * port exists **and** the caller says it is enabled (the route is `PYME`-gated
 * upstream, so a null port fetches nothing). A failed read never invents data:
 * `data` stays `null` and `loadFailed` is the only signal. The controller owns
 * loading and error, never local placeholder data.
 */

/** Sanitized load failure; the code is already provider-free. */
class MyCampaignsError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`my-campaigns request failed: ${code}`);
    this.name = "MyCampaignsError";
    this.code = code;
  }
}

async function load(port: MyCampaignsPort): Promise<MyCampaigns> {
  const result = await port.get();
  if (!result.ok) throw new MyCampaignsError(result.code);
  return result.myCampaigns;
}

export interface MyCampaignsState {
  readonly data: MyCampaigns | null;
  readonly isLoading: boolean;
  readonly loadFailed: boolean;
  readonly reload: () => void;
}

export function useMyCampaigns(port: MyCampaignsPort | null, enabled: boolean): MyCampaignsState {
  const active = port !== null && enabled;
  const { data, error, isLoading, mutate } = useSWR<MyCampaigns>(
    active ? ["my-campaigns"] : null,
    () => load(port as MyCampaignsPort),
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
