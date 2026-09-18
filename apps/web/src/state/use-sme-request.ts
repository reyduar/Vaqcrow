"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import type { SmeRequestFormValues, SmeRequestSubmitError } from "@/application/evidence/review-view-model";
import { submitSmeRequest } from "@/application/evidence/submit-sme-request";
import type { SmeRequestCurrent, SmeRequestGateway } from "@/application/ports/sme-request-gateway";

const UNAVAILABLE: SmeRequestSubmitError = {
  message: "El servicio de solicitudes no está disponible en esta demostración. No se envió nada."
};

/**
 * Server state (current request + sales history) lives in SWR and is
 * revalidated after a successful submit. Only the transient submit outcome is
 * kept locally; the form's own state stays in React Hook Form. With no
 * gateway (no backend configured) nothing is fetched and submit fails
 * explicitly instead of pretending to succeed.
 */
export function useSmeRequest(gateway: SmeRequestGateway | null, smeReference: string) {
  const { data, error, isLoading, mutate } = useSWR<SmeRequestCurrent>(
    gateway ? "sme-request/current" : null,
    () => (gateway as SmeRequestGateway).loadCurrent(),
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<SmeRequestSubmitError | undefined>();
  const [submitted, setSubmitted] = useState(false);

  const submit = useCallback(
    async (values: SmeRequestFormValues) => {
      setSubmitError(undefined);
      setSubmitted(false);
      if (!gateway) {
        setSubmitError(UNAVAILABLE);
        return;
      }
      setIsSubmitting(true);
      const result = await submitSmeRequest(gateway, values, smeReference);
      if (result.ok) {
        setSubmitted(true);
        try {
          await mutate();
        } catch {
          // The submit itself succeeded; a failed refresh surfaces through `loadFailed`.
        }
      } else {
        setSubmitError(result.error);
      }
      setIsSubmitting(false);
    },
    [gateway, smeReference, mutate]
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
