"use client";

import useSWR from "swr";
import type { ApplicationReviewState } from "@vaqcrow/contracts";
import type { SmeRequestCurrent, SmeRequestGateway } from "@/application/ports/sme-request-gateway";

/**
 * Loads one application's own review state by id (Feature #434, WU5), for the
 * `/company` dashboard. `undefined` while there is no id or the read is in
 * flight, so a caller can tell "unknown" apart from a resolved state; a failed
 * read stays `undefined` and never invents a state.
 */
export function useSmeRequestState(
  gateway: SmeRequestGateway | null,
  applicationId: string | null
): ApplicationReviewState | undefined {
  const { data } = useSWR<SmeRequestCurrent>(
    gateway && applicationId ? (["sme-request", applicationId] as const) : null,
    ([, id]: readonly ["sme-request", string]) => (gateway as SmeRequestGateway).load(id),
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );
  return data?.state;
}
