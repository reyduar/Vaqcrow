import { parseHumanDecisionId, type HumanDecisionId } from "@vaqcrow/contracts";
import { decisionFingerprint, type DecisionInput } from "./decision-form";

export interface DecisionAttempt {
  readonly decisionId: HumanDecisionId;
  readonly fingerprint: string;
}

/**
 * One `HumanDecisionId` per decision attempt. Retrying the identical payload
 * reuses the id so the backend can replay idempotently (a lost response never
 * double-records); any changed payload is a new attempt with a fresh id.
 */
export function resolveDecisionAttempt(
  previous: DecisionAttempt | undefined,
  input: DecisionInput,
  generateId: () => string
): DecisionAttempt {
  const fingerprint = decisionFingerprint(input);
  if (previous && previous.fingerprint === fingerprint) return previous;
  return { decisionId: parseHumanDecisionId(generateId()), fingerprint };
}
