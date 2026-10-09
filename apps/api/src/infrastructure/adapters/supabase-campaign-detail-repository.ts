import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { RiskBand } from "@vaqcrow/contracts";
import type {
  CampaignDetailAssessmentRecord,
  CampaignDetailDecisionRecord,
  CampaignDetailRateSnapshot,
  CampaignDetailRecord,
  CampaignDetailRepositoryPort,
  CampaignDetailRepositoryResult,
  CampaignDetailState
} from "../../application/ports/campaign-detail-repository-port.js";

const DETAIL_VIEW = "marketplace_campaign_detail";
const RISK_BANDS: readonly RiskBand[] = ["low", "medium", "high"];
const CAMPAIGN_STATES: readonly CampaignDetailState[] = ["open", "settled", "refundable"];
/** The only content types the view exposes as a photo (#414/WU3 predicate). */
const IMAGE_CONTENT_TYPES: readonly string[] = ["image/jpeg", "image/png"];
const NUMERIC_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

/**
 * Reads the joined `marketplace_campaign_detail` view (one row per published,
 * confirmed campaign), by `campaign_id`. The view already applies the published
 * filter, so the adapter cannot return an unpublished campaign by omission; it
 * only maps the row's columns back to a typed record.
 *
 * PostgREST returns `bigint` as a decimal string (a JSON number is also legal)
 * and `numeric` as a JSON number (a string form is legal), so both are
 * normalized here. A malformed row throws and is caught as `unavailable`; the
 * provider's message/details/hint never reach the caller.
 */
export class SupabaseCampaignDetailRepository implements CampaignDetailRepositoryPort {
  constructor(private readonly client: SupabaseClient) {}

  async findPublished(
    campaignId: string
  ): Promise<CampaignDetailRepositoryResult<CampaignDetailRecord | undefined>> {
    try {
      const { data, error } = await this.client
        .from(DETAIL_VIEW)
        .select("*")
        .eq("campaign_id", campaignId)
        .maybeSingle();

      if (error) return { ok: false, error: this.toError(error) };
      // No row means the campaign is unpublished or unknown; the use case maps
      // both to a 404.
      if (data === null || data === undefined) return { ok: true, value: undefined };

      return { ok: true, value: this.toRecord(data) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  private toRecord(row: unknown): CampaignDetailRecord {
    const value = this.asRecord(row);
    const rateSnapshot = this.toRateSnapshot(value);
    const assessment = this.toAssessment(value);
    const decision = this.toDecision(value);
    return {
      campaignId: this.text(value["campaign_id"]),
      name: this.text(value["name"]),
      sector: this.text(value["sector"]),
      city: this.text(value["city"]),
      description: this.text(value["description"]),
      foundedAt: this.text(value["founded_at"]),
      goalArs: this.bigint(value["goal_ars"]),
      totalStroops: this.bigint(value["total_stroops"]),
      goalStroops: this.bigint(value["goal_stroops"]),
      revenueShare: this.number(value["revenue_share"]),
      deadline: this.text(value["deadline"]),
      state: this.state(value["state"]),
      hasImage: this.hasImage(value),
      vaultAddress: this.optionalText(value["vault_address"]),
      backers: this.integer(value["backers"]),
      ...(rateSnapshot === undefined ? {} : { rateSnapshot }),
      assessment,
      decision
    };
  }

  /**
   * The rating snapshot columns are all-or-none at the schema level, so their
   * absence is read from `fx_rate_version` alone and a partially-written row
   * (which the constraint forbids) throws rather than half-mapping.
   */
  private toRateSnapshot(value: Record<string, unknown>): CampaignDetailRateSnapshot | undefined {
    if (value["fx_rate_version"] === null || value["fx_rate_version"] === undefined) return undefined;
    return {
      version: this.integer(value["fx_rate_version"]),
      usdToArs: this.bigint(value["usd_to_ars"]),
      stroopsPerUsd: this.bigint(value["stroops_per_usd"])
    };
  }

  /**
   * The assessment is present from the LEFT join's own flag; when it is, every
   * field the contract requires must be there (a present-but-incomplete
   * assessment is a data defect, so it throws instead of emitting a partial
   * recommendation).
   */
  private toAssessment(value: Record<string, unknown>): CampaignDetailAssessmentRecord | null {
    if (value["assessment_present"] === false || value["assessment_present"] === null || value["assessment_present"] === undefined) {
      return null;
    }
    if (value["assessment_present"] !== true) throw new Error("Malformed assessment presence flag");
    return {
      riskBand: this.riskBand(value["assessment_risk_band"]),
      confidence: this.number(value["assessment_confidence"]),
      reasons: this.reasons(value["assessment_reasons"]),
      model: this.text(value["assessment_model"]),
      generatedAt: this.text(value["assessment_generated_at"])
    };
  }

  /** The latest decision is present when its actor is; a partial one throws. */
  private toDecision(value: Record<string, unknown>): CampaignDetailDecisionRecord | null {
    const actor = this.optionalText(value["decision_actor"]);
    if (actor === null) return null;
    return {
      actor,
      reason: this.text(value["decision_reason"]),
      approvedLimitArs: this.optionalBigint(value["decision_approved_limit_ars"]),
      recordedAt: this.text(value["decision_recorded_at"])
    };
  }

  /**
   * The photo columns are all-or-none from one lateral row; a partially-written
   * pair (which the view cannot produce) throws rather than half-mapping, and an
   * unexpected content type throws because the view constrains it.
   */
  private hasImage(value: Record<string, unknown>): boolean {
    const objectPath = value["image_object_path"];
    const contentType = value["image_content_type"];
    const pathAbsent = objectPath === null || objectPath === undefined;
    const typeAbsent = contentType === null || contentType === undefined;

    if (pathAbsent && typeAbsent) return false;
    if (typeof objectPath !== "string" || objectPath.length === 0) {
      throw new Error("Malformed image object path");
    }
    if (typeof contentType !== "string" || !IMAGE_CONTENT_TYPES.includes(contentType)) {
      throw new Error("Malformed image content type");
    }
    return true;
  }

  private reasons(value: unknown): readonly string[] {
    if (!Array.isArray(value) || value.length === 0) throw new Error("Malformed assessment reasons");
    return value.map((reason) => {
      if (typeof reason !== "string" || reason.length === 0) throw new Error("Malformed assessment reason");
      return reason;
    });
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

  private optionalText(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return this.text(value);
  }

  private bigint(value: unknown): bigint {
    if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
    if (typeof value === "string" && /^-?(?:0|[1-9]\d*)$/.test(value)) return BigInt(value);
    throw new Error("Malformed bigint column");
  }

  private optionalBigint(value: unknown): bigint | null {
    if (value === null || value === undefined) return null;
    return this.bigint(value);
  }

  /** PostgREST returns `numeric` as a JSON number, but a string form is legal. */
  private number(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && NUMERIC_PATTERN.test(value)) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    throw new Error("Malformed numeric column");
  }

  private integer(value: unknown): number {
    if (typeof value === "number" && Number.isSafeInteger(value)) return value;
    if (typeof value === "string" && /^-?(?:0|[1-9]\d*)$/.test(value)) {
      const parsed = Number(value);
      if (Number.isSafeInteger(parsed)) return parsed;
    }
    throw new Error("Malformed integer column");
  }

  private riskBand(value: unknown): RiskBand {
    if (typeof value === "string" && RISK_BANDS.includes(value as RiskBand)) return value as RiskBand;
    throw new Error("Malformed risk band");
  }

  private state(value: unknown): CampaignDetailState {
    if (typeof value === "string" && CAMPAIGN_STATES.includes(value as CampaignDetailState)) {
      return value as CampaignDetailState;
    }
    throw new Error("Malformed campaign state");
  }

  private toError(error: PostgrestError): { readonly code: "unavailable" } {
    // PII, rows and PostgREST's message/details/hint never enter diagnostics.
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to a caller
    console.error("[SupabaseCampaignDetailRepository] persistence error", { code: error.code });
    return { code: "unavailable" };
  }
}
