import {
  checkCompleteness,
  type CompletenessCheckResult
} from "../../application/completeness/completeness-check.js";
import type {
  CompletenessCheckCommand,
  CompletenessCheckPort
} from "../../application/ports/completeness-check-port.js";

/**
 * The declared-data-only completeness checker (Feature #402, Task #403 / T1a).
 *
 * Deliberately deterministic and non-model: it is the pure rules and nothing
 * else — no LLM, no storage read, no clock, no randomness. It ignores the
 * command's `ownerUserId` because it reads no persisted state. The content-aware
 * checker (U5) composes these same rules and is wired in production; this
 * adapter is kept as the dependency-free reference and test default.
 */
export function createDeterministicCompletenessCheckAdapter(): CompletenessCheckPort {
  return {
    async check(command: CompletenessCheckCommand): Promise<CompletenessCheckResult> {
      return checkCompleteness(command.input);
    }
  };
}
