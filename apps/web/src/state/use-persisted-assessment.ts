"use client";

import useSWR from "swr";
import type { AssessmentView } from "@/application/assessment/assessment-view";
import type { AssessmentGateway } from "@/application/ports/assessment-gateway";

/**
 * The persisted assessment of one application, read from the backend (SWR owns
 * this server state, keyed by the application id).
 *
 * `present` is set only from a validated backend record. `absent` is the
 * backend's truthful "none recorded" (404) or no backend at all. `unavailable`
 * means the read failed or drifted out of contract and is deliberately distinct
 * from `absent`, so an outage is never presented as "no assessment".
 */
export type PersistedAssessmentState =
  | { readonly status: "loading" }
  | { readonly status: "present"; readonly view: AssessmentView }
  | { readonly status: "absent" }
  | { readonly status: "unavailable" };

export function usePersistedAssessment(
  gateway: AssessmentGateway | null,
  applicationId: string
): PersistedAssessmentState {
  const { data, error, isLoading } = useSWR<AssessmentView | null>(
    gateway ? (["application-assessment", applicationId] as const) : null,
    ([, id]: readonly ["application-assessment", string]) => (gateway as AssessmentGateway).load(id),
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );

  if (!gateway) return { status: "absent" };
  if (error !== undefined) return { status: "unavailable" };
  if (isLoading || data === undefined) return { status: "loading" };

  return data ? { status: "present", view: data } : { status: "absent" };
}
