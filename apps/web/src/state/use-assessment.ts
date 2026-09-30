"use client";

import { useCallback, useRef, useState } from "react";
import type { AssessmentView } from "@/application/assessment/assessment-view";
import type { AssessmentGateway } from "@/application/ports/assessment-gateway";
import { HttpClientError } from "@/application/ports/http-client-port";

/**
 * Transient state of one assessment attempt for the journey's application.
 *
 * Each state is set only from what the backend answered: `recorded` from a
 * persisted, validated assessment; `manual_review` when the application went to
 * a person WITHOUT an assessment (the AI failed); `no_sales_evidence` when the
 * request has no sales series and nothing was evaluated. Anything else is
 * `failed`, carrying the backend's own code when there is one. With no
 * application in the journey nothing is called at all.
 *
 * Deciding what a failure *means* for the reviewer is the backend's job: it
 * routes the application to manual review and persists the handoff.
 */
export type AssessmentRequestState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "recorded"; readonly view: AssessmentView }
  | { readonly status: "manual_review"; readonly failureCode: string }
  | { readonly status: "no_sales_evidence" }
  | { readonly status: "failed"; readonly code: string };

// The backend bound the attempt id to a durable record or state: replaying the
// same id can only reproduce the same answer, so the next attempt starts fresh.
const DEFINITIVE_ERROR_CODES: ReadonlySet<string> = new Set(["not_found", "state_conflict", "correlation_conflict"]);

function browserUuid(): string {
  return globalThis.crypto.randomUUID();
}

function failureCode(error: unknown): string {
  if (error instanceof HttpClientError) {
    return error.errorCode ?? "unavailable";
  }
  // A response that drifted is not a backend failure code; it is a contract
  // violation the browser caught. It still means "no assessment to show".
  return "invalid_response";
}

export function useAssessment(
  gateway: AssessmentGateway | null,
  applicationId: string | null,
  generateId: () => string = browserUuid
) {
  const [state, setState] = useState<AssessmentRequestState>({ status: "idle" });
  const inFlightRef = useRef(false);
  // One attempt = one id. It survives a failure whose outcome is unknown (the
  // backend may already have recorded it) so the retry replays instead of
  // colliding with its own earlier record.
  const attemptIdRef = useRef<string | undefined>(undefined);

  const request = useCallback(async () => {
    if (inFlightRef.current) return;

    if (!applicationId) {
      setState({ status: "failed", code: "no_application" });
      return;
    }

    if (!gateway) {
      setState({ status: "failed", code: "not_configured" });
      return;
    }

    inFlightRef.current = true;
    setState({ status: "loading" });
    try {
      const attemptId = attemptIdRef.current ?? generateId();
      attemptIdRef.current = attemptId;
      const outcome = await gateway.assess(applicationId, attemptId);
      attemptIdRef.current = undefined;

      if (outcome.kind === "recorded") {
        setState({ status: "recorded", view: outcome.view });
      } else if (outcome.kind === "manual_review") {
        setState({ status: "manual_review", failureCode: outcome.failureCode });
      } else {
        setState({ status: "no_sales_evidence" });
      }
    } catch (error) {
      const code = failureCode(error);
      if (DEFINITIVE_ERROR_CODES.has(code)) attemptIdRef.current = undefined;
      setState({ status: "failed", code });
    } finally {
      inFlightRef.current = false;
    }
  }, [gateway, applicationId, generateId]);

  return { state, request };
}
