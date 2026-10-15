"use client";

import useSWR from "swr";
import type { MyApplication } from "@vaqcrow/contracts";
import type { SmeRequestGateway } from "@/application/ports/sme-request-gateway";

/**
 * Server state of the signed-in PyME's own application (Feature #530, T3/S6),
 * read owner-scoped through `GET /sme-requests/mine` so the `/company` state is
 * known in a fresh session and not only from an in-session submit.
 *
 * Mirrors `use-sme-request.ts`: `undefined` while there is no gateway, the
 * caller is disabled, the read is in flight or failed, or the PyME owns no
 * application — so a caller can only tell "a resolved application" apart from
 * "nothing to act on" and never a fabricated one. With no configured API base
 * URL the gateway is `null` and nothing is fetched, so a missing read is never
 * a service failure (#480).
 */
export function useMyApplication(
  gateway: SmeRequestGateway | null,
  enabled: boolean
): MyApplication | undefined {
  const active = gateway !== null && enabled;
  const { data } = useSWR<MyApplication | null>(
    active ? (["sme-requests-mine"] as const) : null,
    async () => {
      const outcome = await (gateway as SmeRequestGateway).loadMine();
      // A failure is an absence for this read, never a fabricated application.
      return outcome.ok ? outcome.application : null;
    },
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );
  return data ?? undefined;
}
