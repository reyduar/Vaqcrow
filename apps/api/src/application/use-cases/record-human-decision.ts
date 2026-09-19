import type {
  ApplicationReviewState,
  CorrelationId,
  HumanDecisionCommand,
  HumanDecisionRecord
} from "@vaqcrow/contracts";
import type { ApplicationReviewRepositoryPort } from "../ports/application-review-repository-port.js";

export type RecordHumanDecisionError =
  | { readonly code: "not_found" | "idempotency_conflict" | "unavailable" }
  | { readonly code: "state_conflict"; readonly actualState: ApplicationReviewState };

export type RecordHumanDecisionResult =
  | {
      readonly ok: true;
      readonly value: { readonly decision: HumanDecisionRecord; readonly applied: boolean };
    }
  | { readonly ok: false; readonly error: RecordHumanDecisionError };

export async function recordHumanDecision(
  repository: ApplicationReviewRepositoryPort,
  input: { readonly command: HumanDecisionCommand; readonly correlationId: CorrelationId }
): Promise<RecordHumanDecisionResult> {
  const result = await repository.recordHumanDecision(input);

  if (result.ok) {
    return {
      ok: true,
      value: { decision: result.value.record, applied: result.value.applied }
    };
  }

  if (result.error.code === "state_conflict") {
    return result.error.actualState === undefined
      ? { ok: false, error: { code: "unavailable" } }
      : {
          ok: false,
          error: { code: "state_conflict", actualState: result.error.actualState }
        };
  }

  if (
    result.error.code === "not_found" ||
    result.error.code === "idempotency_conflict" ||
    result.error.code === "unavailable"
  ) {
    return { ok: false, error: { code: result.error.code } };
  }

  return { ok: false, error: { code: "unavailable" } };
}
