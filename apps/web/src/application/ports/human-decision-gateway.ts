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
  /**
   * Reads the application's latest recorded decision. Resolves `null` only when
   * the API answered its truthful `not_found` — the application has no recorded
   * decision yet, a declared absence and never an empty success. Every other
   * failure throws `HttpClientError` exactly as `record` does, so a broken
   * backend can never be mistaken for "no decision".
   */
  readLatest(applicationId: string): Promise<HumanDecisionRecord | null>;
}
