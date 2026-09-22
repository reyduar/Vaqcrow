"use client";

import { useCallback, useRef, useState } from "react";
import type { AssessmentView } from "@/application/assessment/assessment-view";
import type { AssessmentEvidence, AssessmentGateway } from "@/application/ports/assessment-gateway";
import { HttpClientError } from "@/application/ports/http-client-port";

/**
 * Transient state of one assessment request.
 *
 * `ready` is set exclusively from a successful, validated answer — the backend
 * is the only authority on what an assessment is. A failure carries the
 * backend's own code when there is one (`timeout`, `provider_unavailable`,
 * `invalid_output`, `unknown_evidence_reference`) so the UI can say something
 * true; with no gateway configured the failure is explicit rather than silent.
 *
 * Deciding what a failure *means* for the operator is not this hook's job:
 * routing it to manual review belongs to Feature #22.
 */
export type AssessmentRequestState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly view: AssessmentView }
  | { readonly status: "failed"; readonly code: string };

function failureCode(error: unknown): string {
  if (error instanceof HttpClientError) {
    return error.errorCode ?? "unavailable";
  }
  // A response that drifted is not a backend failure code; it is a contract
  // violation the browser caught. It still means "no assessment to show".
  return "invalid_response";
}

export function useAssessment(gateway: AssessmentGateway | null) {
  const [state, setState] = useState<AssessmentRequestState>({ status: "idle" });
  const inFlightRef = useRef(false);

  const request = useCallback(
    async (evidence: AssessmentEvidence) => {
      if (inFlightRef.current) return;

      if (!gateway) {
        setState({ status: "failed", code: "not_configured" });
        return;
      }

      inFlightRef.current = true;
      setState({ status: "loading" });
      try {
        setState({ status: "ready", view: await gateway.assess(evidence) });
      } catch (error) {
        setState({ status: "failed", code: failureCode(error) });
      } finally {
        inFlightRef.current = false;
      }
    },
    [gateway]
  );

  return { state, request };
}
