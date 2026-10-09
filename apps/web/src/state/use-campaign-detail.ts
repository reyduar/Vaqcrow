"use client";

import { useCallback } from "react";
import useSWR from "swr";
import type { CampaignDetail, CampaignDetailPort } from "@/application/ports/campaign-detail-port";

/**
 * Server state of the campaign detail page (Feature #422, WU2).
 *
 * The detail lives in SWR under `["campaign-detail", campaignId]`, keyed only
 * when a port exists **and** the caller says it is enabled (the page is
 * account-gated, so a signed-out visitor fetches nothing). A failed read never
 * invents data: `detail` stays `null` and the flags are the only signal. A 404
 * is kept apart from a generic failure so the UI can show its own not-found
 * state instead of a retry banner.
 */

/** Sanitized load failure; the code is already provider-free. */
class CampaignDetailError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`campaign detail request failed: ${code}`);
    this.name = "CampaignDetailError";
    this.code = code;
  }
}

async function load(port: CampaignDetailPort, campaignId: string): Promise<CampaignDetail> {
  const result = await port.get(campaignId);
  if (!result.ok) throw new CampaignDetailError(result.code);
  return result.detail;
}

export interface CampaignDetailState {
  readonly detail: CampaignDetail | null;
  readonly isLoading: boolean;
  readonly loadFailed: boolean;
  readonly notFound: boolean;
  readonly reload: () => void;
}

export function useCampaignDetail(
  campaignId: string,
  port: CampaignDetailPort | null,
  enabled: boolean
): CampaignDetailState {
  const active = port !== null && enabled;
  const { data, error, isLoading, mutate } = useSWR<CampaignDetail>(
    active ? ["campaign-detail", campaignId] : null,
    () => load(port as CampaignDetailPort, campaignId),
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );

  const reload = useCallback(() => {
    void mutate();
  }, [mutate]);

  const code = error instanceof CampaignDetailError ? error.code : undefined;

  return {
    detail: data ?? null,
    isLoading,
    loadFailed: error !== undefined && code !== "not_found",
    notFound: code === "not_found",
    reload
  };
}
