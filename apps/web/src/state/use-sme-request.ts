"use client";

import { useCallback, useRef, useState } from "react";
import useSWR from "swr";
import type { ApplicationReviewState } from "@vaqcrow/contracts";
import type { SmeRequestFormValues, SmeRequestSubmitError } from "@/application/evidence/review-view-model";
import { submitSmeRequest } from "@/application/evidence/submit-sme-request";
import type { SmeRequestCurrent, SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import { useJourneyStore } from "./journey-store-provider";

const UNAVAILABLE: SmeRequestSubmitError = {
  message: "El servicio de solicitudes no está disponible en esta demostración. No se envió nada."
};

/**
 * Server state (request + sales history) lives in SWR, keyed by the journey
 * store's `applicationId` (null: nothing to fetch). A successful submit records
 * the returned id in the store, which switches the SWR key and loads the
 * stored request. Only the transient submit outcome is kept locally; the
 * form's own state stays in React Hook Form. With no gateway (no backend
 * configured) nothing is fetched and submit fails explicitly instead of
 * pretending to succeed. A second submit while one is pending is ignored.
 */
export function useSmeRequest(gateway: SmeRequestGateway | null, smeReference: string) {
  const applicationId = useJourneyStore((state) => state.applicationId);
  const recordApplication = useJourneyStore((state) => state.recordApplication);
  const { data, error, isLoading } = useSWR<SmeRequestCurrent>(
    gateway && applicationId ? (["sme-request", applicationId] as const) : null,
    ([, id]: readonly ["sme-request", string]) => (gateway as SmeRequestGateway).load(id),
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<SmeRequestSubmitError | undefined>();
  const [submitted, setSubmitted] = useState(false);
  const inFlight = useRef(false);

  const submit = useCallback(
    async (values: SmeRequestFormValues) => {
      if (inFlight.current) return;
      setSubmitError(undefined);
      setSubmitted(false);
      if (!gateway) {
        setSubmitError(UNAVAILABLE);
        return;
      }
      inFlight.current = true;
      setIsSubmitting(true);
      try {
        const result = await submitSmeRequest(gateway, values, smeReference);
        if (result.ok) {
          recordApplication(result.applicationId);
          setSubmitted(true);
        } else {
          setSubmitError(result.error);
        }
      } finally {
        inFlight.current = false;
        setIsSubmitting(false);
      }
    },
    [gateway, smeReference, recordApplication]
  );

  return {
    current: data,
    isLoading,
    loadFailed: error !== undefined,
    submit,
    isSubmitting,
    submitError,
    submitted
  };
}

/**
 * Loads one application's own review state by id, without the journey store
 * (Feature #434, WU5): the `/company` dashboard has no journey provider, so it
 * cannot use `useSmeRequest`. `undefined` while there is no id or the read is in
 * flight, so a caller can tell "unknown" apart from a resolved state; a failed
 * read stays `undefined` and never invents a state. Shares the `useSmeRequest`
 * SWR cache key, so a state read and a full read of the same application
 * de-duplicate.
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
