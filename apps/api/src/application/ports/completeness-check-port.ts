import type {
  CompletenessCheckInput,
  CompletenessCheckResult
} from "../completeness/completeness-check.js";

/**
 * The completeness-check boundary (Feature #402, Task #403 / T1a; extended by
 * the content-relevance/vision feature, U5).
 *
 * Plain data only: this port lives in `application/` and names neither Fastify,
 * Supabase, the storage adapter nor a model SDK.
 *
 * **Owner contract.** The content-aware implementation must resolve the owner's
 * persisted documents, read their bytes and judge them; it therefore needs an
 * owner identity. That owner is the verified principal's `userId`, resolved by
 * the route from the access token and passed here — it is **never** accepted from
 * the request body. The declared body stays untrusted and strictly validated
 * (`CompletenessCheckInput`); `CompletenessCheckCommand` keeps the two separate
 * so a client can never choose whose documents are checked.
 *
 * A future multimodal checker is one more implementation of this interface; the
 * deterministic declared-data adapter and the content-aware adapter are both.
 */
export interface CompletenessCheckCommand {
  /** The verified principal's id; never a value trusted from the request body. */
  readonly ownerUserId: string;
  /** The strictly validated, untrusted declared metadata from the client body. */
  readonly input: CompletenessCheckInput;
}

export interface CompletenessCheckPort {
  check(command: CompletenessCheckCommand): Promise<CompletenessCheckResult>;
}
