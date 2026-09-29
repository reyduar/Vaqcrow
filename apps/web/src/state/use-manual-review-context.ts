"use client";

import { useEffect, useState } from "react";
import type { ApplicationManualReviewContext } from "@vaqcrow/contracts";
import type { ManualReviewGateway } from "@/application/ports/manual-review-gateway";

/**
 * The persisted manual-review context for one application, if any.
 *
 * `present` is set only from a contract-validated backend answer. `absent`
 * covers both "the backend says there is no handoff" (a truthful `404`) and
 * "no backend is configured / the request failed": in neither case does the
 * screen invent context, and the unrelated-flow copy it falls back to is
 * labelled `SIMULADO` rather than presented as a persisted record.
 */
export type ManualReviewState =
  | { readonly status: "loading" }
  | { readonly status: "present"; readonly context: ApplicationManualReviewContext }
  | { readonly status: "absent" };

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
        if (active) setState({ status: "absent" });
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
