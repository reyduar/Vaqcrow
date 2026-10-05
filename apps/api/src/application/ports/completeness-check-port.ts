import type {
  CompletenessCheckInput,
  CompletenessCheckResult
} from "../completeness/completeness-check.js";

/**
 * The completeness-check boundary (Feature #402, Task #403 / T1a).
 *
 * Plain data only: this port lives in `application/` and names neither Fastify,
 * Supabase, the storage adapter nor a model SDK. A future content-aware
 * (multimodal) checker is one more implementation of this interface; today the
 * deterministic declared-data adapter is the only one.
 */
export interface CompletenessCheckPort {
  check(input: CompletenessCheckInput): Promise<CompletenessCheckResult>;
}
