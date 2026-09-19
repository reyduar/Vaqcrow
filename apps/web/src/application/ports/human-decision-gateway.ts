import type { HumanDecisionCommand, HumanDecisionRecord } from "@vaqcrow/contracts";

/** Successful backend answer. `applied: false` is an idempotent replay of an already recorded decision. */
export interface RecordedHumanDecision {
  readonly applied: boolean;
  readonly decision: HumanDecisionRecord;
}

/**
 * Port for the human decision backend (`POST /application-reviews/:applicationId/decisions`).
 * Implementations return contract-validated data and throw on anything else;
 * HTTP failures surface as `HttpClientError` so `application/` can classify them.
 */
export interface HumanDecisionGateway {
  record(command: HumanDecisionCommand): Promise<RecordedHumanDecision>;
}
