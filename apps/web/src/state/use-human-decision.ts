"use client";

import { useCallback, useRef, useState } from "react";
import { resolveDecisionAttempt, type DecisionAttempt } from "@/application/decision/decision-attempt";
import type { DecisionInput } from "@/application/decision/decision-form";
import { decisionErrorOfKind, type DecisionSubmitError } from "@/application/decision/human-decision-errors";
import { recordHumanDecision } from "@/application/decision/record-human-decision";
import type { HumanDecisionGateway, RecordedHumanDecision } from "@/application/ports/human-decision-gateway";

function browserUuid(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Transient state of one human decision. The backend is the only authority:
 * `recorded` is set exclusively from a successful, contract-validated server
 * answer. The attempt (decision id + payload fingerprint) survives failures so
 * retrying the same payload replays idempotently instead of double-recording.
 * With no gateway (no backend configured) submit fails explicitly.
 */
export function useHumanDecision(
  gateway: HumanDecisionGateway | null,
  applicationId: string,
  generateId: () => string = browserUuid
) {
  const attemptRef = useRef<DecisionAttempt | undefined>(undefined);
  const inFlightRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<DecisionSubmitError | undefined>();
  const [recorded, setRecorded] = useState<RecordedHumanDecision | undefined>();

  const submit = useCallback(
    async (input: DecisionInput) => {
      if (inFlightRef.current) return;
      setError(undefined);
      if (!gateway) {
        setError(decisionErrorOfKind("unavailable"));
        return;
      }

      inFlightRef.current = true;
      setIsSubmitting(true);
      try {
        const attempt = resolveDecisionAttempt(attemptRef.current, input, generateId);
        attemptRef.current = attempt;
        const result = await recordHumanDecision(gateway, {
          applicationId,
          decisionId: attempt.decisionId,
          input
        });
        if (result.ok) setRecorded(result.value);
        else {
          // The server already bound this decision id to a different payload;
          // keeping the attempt would replay the same conflict forever.
          if (result.error.kind === "idempotency_conflict") attemptRef.current = undefined;
          setError(result.error);
        }
      } catch {
        // An invalid generated id is a programming error, not a backend outcome.
        setError(decisionErrorOfKind("unknown"));
      } finally {
        inFlightRef.current = false;
        setIsSubmitting(false);
      }
    },
    [gateway, applicationId, generateId]
  );

  return { submit, isSubmitting, error, recorded };
}
