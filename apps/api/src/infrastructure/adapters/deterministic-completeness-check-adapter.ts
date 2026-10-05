import {
  checkCompleteness,
  type CompletenessCheckInput,
  type CompletenessCheckResult
} from "../../application/completeness/completeness-check.js";
import type { CompletenessCheckPort } from "../../application/ports/completeness-check-port.js";

/**
 * The completeness checker the demo runs on (Feature #402, Task #403 / T1a).
 *
 * Deliberately deterministic and non-model: the owner scoped this slice to
 * declared data and document presence, so the check is the pure rules and
 * nothing else — no LLM, no storage read, no clock, no randomness. A future
 * content-aware checker replaces this at the composition root without touching
 * the port or its callers.
 */
export function createDeterministicCompletenessCheckAdapter(): CompletenessCheckPort {
  return {
    async check(input: CompletenessCheckInput): Promise<CompletenessCheckResult> {
      return checkCompleteness(input);
    }
  };
}
