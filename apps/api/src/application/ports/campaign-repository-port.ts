import type { ApplicationId, CorrelationId } from "@vaqcrow/contracts";

export type CampaignState = "open" | "settled" | "refundable";
export type ReconciliationStatus = "in_sync" | "diverged";

export interface CampaignRecord {
  readonly campaignId: string;
  readonly applicationId: ApplicationId;
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
