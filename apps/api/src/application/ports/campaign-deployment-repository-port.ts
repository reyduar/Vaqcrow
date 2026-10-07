import type { ApplicationId, CorrelationId } from "@vaqcrow/contracts";

/**
 * The persisted vault-deployment lifecycle (Feature #410, Task #410 / T5b).
 *
 * One row per application records what happened after an admin approved it:
 * `pending` the moment approval is applied, `deploying` while the platform
 * signs and submits `factory.deploy`, `confirmed` once Testnet reports the
 * vault, or `failed` with a sanitized code the admin can retry from. The row is
 * the durable idempotency anchor for the deploy, independent of the campaign
 * mirror: a confirmed deployment is what makes a replay a no-op.
 *
 * Plain data only: this port lives in `application/` and imports no Fastify,
 * Supabase or Stellar SDK. `lastError` is a code the application owns (for
 * example `rate_unavailable`), never provider text or an exception message.
 */

export type CampaignDeploymentState = "pending" | "deploying" | "confirmed" | "failed";

export interface CampaignDeploymentRecord {
  readonly applicationId: ApplicationId;
  readonly state: CampaignDeploymentState;
  readonly attempts: number;
  /** A sanitized code the API owns; `undefined` when the last attempt did not fail. */
  readonly lastError?: string;
  /** The mirrored campaign a confirmation created; `undefined` until then. */
  readonly campaignId?: string;
  readonly lastCorrelationId: CorrelationId;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type CampaignDeploymentRepositoryErrorCode = "not_found" | "state_conflict" | "unavailable";

export interface CampaignDeploymentRepositoryError {
  readonly code: CampaignDeploymentRepositoryErrorCode;
}

export type CampaignDeploymentRepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: CampaignDeploymentRepositoryError };

export interface CampaignDeploymentRepositoryPort {
  /** `not_found` means no deployment has been started for that application. */
  findByApplicationId(
    applicationId: ApplicationId
  ): Promise<CampaignDeploymentRepositoryResult<CampaignDeploymentRecord>>;

  /**
   * Inserts the row as `pending` if it is absent. Idempotent: an existing row is
   * returned unchanged, so a confirmed deployment is never reset to pending.
   */
  markPending(input: {
    readonly applicationId: ApplicationId;
    readonly correlationId: CorrelationId;
  }): Promise<CampaignDeploymentRepositoryResult<CampaignDeploymentRecord>>;

  /**
   * Moves `pending`/`failed` to `deploying` and increments `attempts`, clearing
   * `last_error`. Any other current state is a `state_conflict`; the conditional
   * update means a concurrent attempt cannot double-apply.
   */
  beginAttempt(input: {
    readonly applicationId: ApplicationId;
    readonly correlationId: CorrelationId;
  }): Promise<CampaignDeploymentRepositoryResult<CampaignDeploymentRecord>>;

  /** Records the mirrored campaign id and the `confirmed` state. */
  markConfirmed(input: {
    readonly applicationId: ApplicationId;
    readonly campaignId: string;
    readonly correlationId: CorrelationId;
  }): Promise<CampaignDeploymentRepositoryResult<CampaignDeploymentRecord>>;

  /** Records the `failed` state and the sanitized code of the last attempt. */
  markFailed(input: {
    readonly applicationId: ApplicationId;
    readonly errorCode: string;
    readonly correlationId: CorrelationId;
  }): Promise<CampaignDeploymentRepositoryResult<CampaignDeploymentRecord>>;
}
