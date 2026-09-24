import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { parseApplicationId } from "@vaqcrow/contracts";
import type { ApplicationId, CorrelationId } from "@vaqcrow/contracts";
import type {
  CampaignContributionRecord,
  CampaignRecord,
  CampaignReconciliationOutcome,
  CampaignRefundContact,
  CampaignRepositoryError,
  CampaignRepositoryPort,
  CampaignRepositoryResult,
  CampaignState,
  ChainCampaignSnapshot,
  ReconciliationStatus
} from "../../application/ports/campaign-repository-port.js";

const CAMPAIGN_TABLE = "campaign";
const CONTRIBUTION_TABLE = "campaign_contribution";
const REFUND_CONTACT_TABLE = "campaign_refund_contact";
const UNIQUE_VIOLATION = "23505";
const CAMPAIGN_STATES: readonly CampaignState[] = ["open", "settled", "refundable"];
const RECONCILIATION_STATUSES: readonly ReconciliationStatus[] = ["in_sync", "diverged"];

/**
 * Supabase mirror for contract custody. The adapter only accepts snapshots that
 * a caller has already read from Stellar; it never creates a financial fact.
 */
export class SupabaseCampaignRepository implements CampaignRepositoryPort {
  constructor(private readonly client: SupabaseClient) {}

  async create(input: {
    campaign: Omit<CampaignRecord, "createdAt" | "updatedAt" | "lastDivergedAt">;
    correlationId: CorrelationId;
  }): Promise<CampaignRepositoryResult<CampaignRecord>> {
    try {
      const { data, error } = await this.client
        .from(CAMPAIGN_TABLE)
        .insert(this.toCampaignInsert(input.campaign, input.correlationId))
        .select()
        .single();

      if (error) {
        return {
          ok: false,
          error: error.code === UNIQUE_VIOLATION ? { code: "already_exists" } : this.toError(error, input.correlationId)
        };
      }

      return { ok: true, value: this.toCampaign(data) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async findById(campaignId: string): Promise<CampaignRepositoryResult<CampaignRecord>> {
    try {
      const { data, error } = await this.client
        .from(CAMPAIGN_TABLE)
        .select()
        .eq("campaign_id", campaignId)
        .maybeSingle();

      if (error) return { ok: false, error: this.toError(error) };
      if (!data) return { ok: false, error: { code: "not_found" } };
      return { ok: true, value: this.toCampaign(data) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async findByApplicationId(applicationId: ApplicationId): Promise<CampaignRepositoryResult<CampaignRecord>> {
    try {
      const { data, error } = await this.client
        .from(CAMPAIGN_TABLE)
        .select()
        .eq("application_id", applicationId)
        .maybeSingle();

      if (error) return { ok: false, error: this.toError(error) };
      if (!data) return { ok: false, error: { code: "not_found" } };
      return { ok: true, value: this.toCampaign(data) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async findContributions(
    campaignId: string
  ): Promise<CampaignRepositoryResult<readonly CampaignContributionRecord[]>> {
    try {
      const { data, error } = await this.client
        .from(CONTRIBUTION_TABLE)
        .select()
        .eq("campaign_id", campaignId)
        .order("investor_account_id", { ascending: true });

      if (error) return { ok: false, error: this.toError(error) };
      if (!Array.isArray(data)) throw new Error("Malformed contribution read");
      return { ok: true, value: data.map((row) => this.toContribution(row)) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async reconcile(input: {
    campaignId: string;
    expectedState: CampaignState;
    snapshot: ChainCampaignSnapshot;
    reconciliationStatus: ReconciliationStatus;
    correlationId: CorrelationId;
  }): Promise<CampaignRepositoryResult<CampaignReconciliationOutcome>> {
    try {
      const { data, error } = await this.client
        .from(CAMPAIGN_TABLE)
        .update(this.toReconciliationUpdate(input.snapshot, input.reconciliationStatus, input.correlationId))
        .eq("campaign_id", input.campaignId)
        .eq("state", input.expectedState)
        // A delayed RPC response must never overwrite a newer chain observation.
        .lte("last_reconciled_at", input.snapshot.observedAt)
        .select()
        .maybeSingle();

      if (error) return { ok: false, error: this.toError(error, input.correlationId) };
      if (!data) return this.resolveUnappliedReconciliation(input.campaignId);

      // A zero-stroop entry means "never contributed yet" (an investor who
      // has only connected, or one who just withdrew/was refunded back to
      // zero) — there is nothing to mirror, and the table's own
      // `campaign_contribution_amount_stroops_check` (`amount_stroops > 0`)
      // refuses the row outright. Writing was previously unconditional here,
      // so a zero contribution failed the whole reconcile as `unavailable`
      // (Task #248/T4's live suite against the real schema).
      for (const contribution of input.snapshot.contributions) {
        if (contribution.amountStroops <= 0n) continue;
        const written = await this.writeContribution(input.campaignId, contribution, input.correlationId);
        if (!written.ok) return written;
      }

      return { ok: true, value: { campaign: this.toCampaign(data), applied: true } };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async saveRefundContact(input: {
    contact: CampaignRefundContact;
    correlationId: CorrelationId;
  }): Promise<CampaignRepositoryResult<CampaignRefundContact>> {
    const row = this.toRefundContactRow(input.contact, input.correlationId);

    try {
      const { data, error } = await this.client.from(REFUND_CONTACT_TABLE).insert(row).select().single();
      if (!error) return { ok: true, value: this.toRefundContact(data) };
      if (error.code !== UNIQUE_VIOLATION) return { ok: false, error: this.toError(error, input.correlationId) };

      const { data: updated, error: updateError } = await this.client
        .from(REFUND_CONTACT_TABLE)
        .update(row)
        .eq("campaign_id", input.contact.campaignId)
        .eq("investor_account_id", input.contact.investorAccountId)
        .select()
        .maybeSingle();

      if (updateError) return { ok: false, error: this.toError(updateError, input.correlationId) };
      if (!updated) return { ok: false, error: { code: "state_conflict" } };
      return { ok: true, value: this.toRefundContact(updated) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  private async resolveUnappliedReconciliation(
    campaignId: string
  ): Promise<CampaignRepositoryResult<CampaignReconciliationOutcome>> {
    const existing = await this.findById(campaignId);
    if (!existing.ok) return existing;
    return { ok: true, value: { campaign: existing.value, applied: false } };
  }

  private async writeContribution(
    campaignId: string,
    contribution: Omit<CampaignContributionRecord, "campaignId">,
    correlationId: CorrelationId
  ): Promise<CampaignRepositoryResult<void>> {
    const row = {
      campaign_id: campaignId,
      investor_account_id: contribution.investorAccountId,
      amount_stroops: contribution.amountStroops.toString(),
      last_observed_at: contribution.lastObservedAt,
      last_correlation_id: correlationId
    };

    const { error } = await this.client.from(CONTRIBUTION_TABLE).insert(row);
    if (!error) return { ok: true, value: undefined };
    if (error.code !== UNIQUE_VIOLATION) return { ok: false, error: this.toError(error, correlationId) };

    const { error: updateError } = await this.client
      .from(CONTRIBUTION_TABLE)
      .update(row)
      .eq("campaign_id", campaignId)
      .eq("investor_account_id", contribution.investorAccountId)
      .lte("last_observed_at", contribution.lastObservedAt);

    return updateError
      ? { ok: false, error: this.toError(updateError, correlationId) }
      : { ok: true, value: undefined };
  }

  private toCampaignInsert(
    campaign: Omit<CampaignRecord, "createdAt" | "updatedAt" | "lastDivergedAt">,
    correlationId: CorrelationId
  ): Record<string, unknown> {
    return {
      campaign_id: campaign.campaignId,
      application_id: campaign.applicationId,
      sme_account_id: campaign.smeAccountId,
      contract_address: campaign.contractAddress,
      network: campaign.network,
      token_contract_address: campaign.tokenContractAddress,
      goal_stroops: campaign.goalStroops.toString(),
      deadline: campaign.deadline,
      state: campaign.state,
      total_stroops: campaign.totalStroops.toString(),
      reconciliation_status: campaign.reconciliationStatus,
      last_reconciled_at: campaign.lastReconciledAt,
      last_correlation_id: correlationId
    };
  }

  private toReconciliationUpdate(
    snapshot: ChainCampaignSnapshot,
    status: ReconciliationStatus,
    correlationId: CorrelationId
  ): Record<string, unknown> {
    return {
      state: snapshot.state,
      total_stroops: snapshot.totalStroops.toString(),
      reconciliation_status: status,
      last_reconciled_at: snapshot.observedAt,
      ...(status === "diverged" ? { last_diverged_at: snapshot.observedAt } : {}),
      last_correlation_id: correlationId
    };
  }

  private toRefundContactRow(contact: CampaignRefundContact, correlationId: CorrelationId): Record<string, unknown> {
    return {
      campaign_id: contact.campaignId,
      investor_account_id: contact.investorAccountId,
      notification_email: contact.notificationEmail,
      refund_due_at: contact.refundDueAt ?? null,
      notified_at: contact.notifiedAt ?? null,
      last_correlation_id: correlationId
    };
  }

  private toCampaign(row: unknown): CampaignRecord {
    const value = this.asRecord(row);
    const lastDivergedAt = value["last_diverged_at"];
    return {
      campaignId: this.text(value["campaign_id"]),
      applicationId: parseApplicationId(value["application_id"]),
      smeAccountId: this.text(value["sme_account_id"]),
      contractAddress: this.text(value["contract_address"]),
      network: this.text(value["network"]),
      tokenContractAddress: this.text(value["token_contract_address"]),
      goalStroops: this.bigint(value["goal_stroops"]),
      deadline: this.text(value["deadline"]),
      state: this.state(value["state"]),
      totalStroops: this.bigint(value["total_stroops"]),
      reconciliationStatus: this.status(value["reconciliation_status"]),
      lastReconciledAt: this.text(value["last_reconciled_at"]),
      ...(lastDivergedAt === null || lastDivergedAt === undefined
        ? {}
        : { lastDivergedAt: this.text(lastDivergedAt) }),
      createdAt: this.text(value["created_at"]),
      updatedAt: this.text(value["updated_at"])
    };
  }

  private toContribution(row: unknown): CampaignContributionRecord {
    const value = this.asRecord(row);
    return {
      campaignId: this.text(value["campaign_id"]),
      investorAccountId: this.text(value["investor_account_id"]),
      amountStroops: this.bigint(value["amount_stroops"]),
      lastObservedAt: this.text(value["last_observed_at"])
    };
  }

  private toRefundContact(row: unknown): CampaignRefundContact {
    const value = this.asRecord(row);
    const refundDueAt = value["refund_due_at"];
    const notifiedAt = value["notified_at"];
    return {
      campaignId: this.text(value["campaign_id"]),
      investorAccountId: this.text(value["investor_account_id"]),
      notificationEmail: this.text(value["notification_email"]),
      ...(refundDueAt === null || refundDueAt === undefined ? {} : { refundDueAt: this.text(refundDueAt) }),
      ...(notifiedAt === null || notifiedAt === undefined ? {} : { notifiedAt: this.text(notifiedAt) })
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("Malformed persistence row");
    }
    return value as Record<string, unknown>;
  }

  private text(value: unknown): string {
    if (typeof value !== "string" || value.length === 0) throw new Error("Malformed text column");
    return value;
  }

  private bigint(value: unknown): bigint {
    if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
    if (typeof value === "string" && /^-?(?:0|[1-9]\d*)$/.test(value)) return BigInt(value);
    throw new Error("Malformed bigint column");
  }

  private state(value: unknown): CampaignState {
    if (typeof value !== "string" || !CAMPAIGN_STATES.includes(value as CampaignState)) {
      throw new Error("Malformed campaign state");
    }
    return value as CampaignState;
  }

  private status(value: unknown): ReconciliationStatus {
    if (typeof value !== "string" || !RECONCILIATION_STATUSES.includes(value as ReconciliationStatus)) {
      throw new Error("Malformed reconciliation status");
    }
    return value as ReconciliationStatus;
  }

  private toError(error: PostgrestError, correlationId?: CorrelationId): CampaignRepositoryError {
    // PII, rows and PostgREST's message/details/hint never enter diagnostics.
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to a caller
    console.error("[SupabaseCampaignRepository] persistence error", { code: error.code, correlationId });
    return { code: "unavailable" };
  }
}
