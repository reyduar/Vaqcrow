"use client";

import { useEffect, useState } from "react";
import type { ApplicationManualReviewContext } from "@vaqcrow/contracts";
import type { ManualReviewGateway } from "@/application/ports/manual-review-gateway";

/**
 * The persisted manual-review context for one application, if any.
 *
 * `present` is set only from a contract-validated backend answer. `absent` is
 * the backend's truthful "there is no handoff" (a `404`): the screen then falls
 * back to its unrelated-flow copy, labelled `SIMULADO`. `unavailable` means the
 * context could not be requested — a backend outage, a network failure or a
 * response that drifted out of contract — and is deliberately distinct from
 * `absent`, so an outage is never presented as "there is no handoff" and the
 * screen never shows the unrelated simulated recommendation as if it were the
 * persisted record.
 */
export type ManualReviewState =
  | { readonly status: "loading" }
  | { readonly status: "present"; readonly context: ApplicationManualReviewContext }
  | { readonly status: "absent" }
  | { readonly status: "unavailable" };

export function useManualReviewContext(
  gateway: ManualReviewGateway | null,
  applicationId: string
): ManualReviewState {
  const [state, setState] = useState<ManualReviewState>(() =>
    gateway ? { status: "loading" } : { status: "absent" }
  );

  useEffect(() => {
    if (!gateway) return;

    let active = true;

    gateway
      .load(applicationId)
      .then((context) => {
        if (!active) return;
        setState(context ? { status: "present", context } : { status: "absent" });
      })
      .catch(() => {
        // The request itself failed: this is not "no handoff", and treating it as
        // such would hide a durable context behind a simulated recommendation.
        if (active) setState({ status: "unavailable" });
      });

    return () => {
      active = false;
    };
  }, [gateway, applicationId]);

  // Derived, not stored: with no gateway there is nothing to load, so the
  // screen falls back to its unrelated-flow copy without inventing context.
  if (!gateway) return { status: "absent" };

  return state;
}
