import type { ApplicationId, CorrelationId } from "@vaqcrow/contracts";

export type CampaignState = "open" | "settled" | "refundable";
export type ReconciliationStatus = "in_sync" | "diverged";

/**
 * The FX rate the campaign's terms were validated against when its vault was
 * deployed (#410/T3a, decision D6). A copy of the values, not a reference to
 * the current rate: changing the rate table later must never move the cap on
 * a campaign already published. Optional because campaigns opened before the
 * snapshot existed carry none.
 */
export interface CampaignRateSnapshot {
  readonly version: number;
  /** ARS per USD, scaled by `RATE_SCALE`. */
  readonly usdToArs: bigint;
  /** Native stroops per USD. */
  readonly stroopsPerUsd: bigint;
}

export interface CampaignRecord {
  readonly campaignId: string;
  readonly applicationId: ApplicationId;
  /** The SME's own Stellar public key, captured when the vault opens (`D7`). */
  readonly smeAccountId: string;
  readonly contractAddress: string;
  readonly network: string;
  readonly tokenContractAddress: string;
  readonly goalStroops: bigint;
  readonly deadline: string;
  readonly state: CampaignState;
  readonly totalStroops: bigint;
  readonly reconciliationStatus: ReconciliationStatus;
  readonly lastReconciledAt: string;
  readonly lastDivergedAt?: string;
  /** Present only when the campaign's terms were validated against a rate snapshot (#410/T3a). */
  readonly rateSnapshot?: CampaignRateSnapshot;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CampaignContributionRecord {
  readonly campaignId: string;
  readonly investorAccountId: string;
  readonly amountStroops: bigint;
  readonly lastObservedAt: string;
}

export interface CampaignRefundContact {
  readonly campaignId: string;
  readonly investorAccountId: string;
  readonly notificationEmail: string;
  readonly refundDueAt?: string;
  readonly notifiedAt?: string;
}

export interface ChainCampaignSnapshot {
  readonly state: CampaignState;
  readonly totalStroops: bigint;
  readonly observedAt: string;
  readonly contributions: readonly Omit<CampaignContributionRecord, "campaignId">[];
}

export type CampaignRepositoryError =
  | { readonly code: "not_found" }
  | { readonly code: "already_exists" }
  | { readonly code: "state_conflict" }
  | { readonly code: "unavailable" };

export type CampaignRepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: CampaignRepositoryError };

export interface CampaignReconciliationOutcome {
  readonly campaign: CampaignRecord;
  /** False means another reconciliation already moved the campaign's state. */
  readonly applied: boolean;
}

/**
 * The database is a queryable mirror, never the authority for money. Callers
 * supply only facts already observed from the contract; this port has no method
 * to invent a balance, settle a campaign, or move funds.
 */
export interface CampaignRepositoryPort {
  create(input: {
    readonly campaign: Omit<CampaignRecord, "createdAt" | "updatedAt" | "lastDivergedAt">;
    readonly correlationId: CorrelationId;
  }): Promise<CampaignRepositoryResult<CampaignRecord>>;

  findById(campaignId: string): Promise<CampaignRepositoryResult<CampaignRecord>>;

  /**
   * Backs the `open-campaign` idempotency check (D5): the salt a retry
   * derives from `applicationId` is deterministic, so a campaign already
   * mirrored for this application is the same campaign a retry would deploy
   * again. `not_found` is the expected answer the first time a given
   * application opens its vault, not an error.
   */
  findByApplicationId(applicationId: ApplicationId): Promise<CampaignRepositoryResult<CampaignRecord>>;

  findContributions(campaignId: string): Promise<CampaignRepositoryResult<readonly CampaignContributionRecord[]>>;

  reconcile(input: {
    readonly campaignId: string;
    readonly expectedState: CampaignState;
    readonly snapshot: ChainCampaignSnapshot;
    readonly reconciliationStatus: ReconciliationStatus;
    readonly correlationId: CorrelationId;
  }): Promise<CampaignRepositoryResult<CampaignReconciliationOutcome>>;

  saveRefundContact(input: {
    readonly contact: CampaignRefundContact;
    readonly correlationId: CorrelationId;
  }): Promise<CampaignRepositoryResult<CampaignRefundContact>>;
}
