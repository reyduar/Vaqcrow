import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  MyCampaignDistributionRecord,
  MyCampaignRateSnapshot,
  MyCampaignRecord,
  MyCampaignRepositoryState,
  MyCampaignSalesRecord,
  MyCampaignsRepositoryPort,
  MyCampaignsRepositoryResult
} from "../../application/ports/my-campaigns-repository-port.js";

/**
 * The PyME dashboard read adapter (#434, WU1).
 *
 * Reads the three service_role-only, `security_invoker` views, always filtered
 * by the caller-resolved `owner_user_id`, so it can never read another PyME's
 * rows:
 *   * `my_campaign_summary` — one row per campaign the owner owns.
 *   * `my_campaign_distribution` — one row per campaign distribution, with its
 *     recipients aggregated.
 *   * `my_campaign_sales` — one row per declared-sales month of the campaign's
 *     company.
 *
 * A malformed row or a provider error is `unavailable`; PostgREST's
 * message/details/hint and the private object path never cross this boundary.
 */

const SUMMARY_VIEW = "my_campaign_summary";
const DISTRIBUTION_VIEW = "my_campaign_distribution";
const SALES_VIEW = "my_campaign_sales";

const CAMPAIGN_STATES: readonly MyCampaignRepositoryState[] = ["open", "settled", "refundable"];
const DISTRIBUTION_STATES: readonly MyCampaignDistributionRecord["state"][] = [
  "submitted",
  "confirmed",
  "failed"
];
const SALES_STATUSES: readonly MyCampaignSalesRecord["status"][] = ["reported", "missing", "anomalous"];
/** The only content types the view exposes as an image (#414/WU3 predicate). */
const IMAGE_CONTENT_TYPES: readonly string[] = ["image/jpeg", "image/png"];

export class SupabaseMyCampaignsRepository implements MyCampaignsRepositoryPort {
  constructor(private readonly client: SupabaseClient) {}

  async listCampaigns(ownerUserId: string): Promise<MyCampaignsRepositoryResult<readonly MyCampaignRecord[]>> {
    try {
      const { data, error } = await this.client
        .from(SUMMARY_VIEW)
        .select("*")
        .eq("owner_user_id", ownerUserId)
        .order("created_at", { ascending: false });

      if (error) return { ok: false, error: this.toError(error) };
      if (!Array.isArray(data)) throw new Error("Malformed my-campaigns read");

      return { ok: true, value: data.map((row) => this.toCampaign(row)) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async listDistributions(
    ownerUserId: string
  ): Promise<MyCampaignsRepositoryResult<readonly MyCampaignDistributionRecord[]>> {
    try {
      const { data, error } = await this.client
        .from(DISTRIBUTION_VIEW)
        .select("*")
        .eq("owner_user_id", ownerUserId)
        .order("period", { ascending: true });

      if (error) return { ok: false, error: this.toError(error) };
      if (!Array.isArray(data)) throw new Error("Malformed my-campaigns read");

      return { ok: true, value: data.map((row) => this.toDistribution(row)) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async listSales(ownerUserId: string): Promise<MyCampaignsRepositoryResult<readonly MyCampaignSalesRecord[]>> {
    try {
      const { data, error } = await this.client
        .from(SALES_VIEW)
        .select("*")
        .eq("owner_user_id", ownerUserId)
        .order("campaign_id", { ascending: true })
        .order("period", { ascending: true });

      if (error) return { ok: false, error: this.toError(error) };
      if (!Array.isArray(data)) throw new Error("Malformed my-campaigns read");

      return { ok: true, value: data.map((row) => this.toSales(row)) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  private toCampaign(row: unknown): MyCampaignRecord {
    const value = this.asRecord(row);
    const rateSnapshot = this.toRateSnapshot(value);
    return {
      campaignId: this.text(value["campaign_id"]),
      name: this.text(value["name"]),
      sector: this.text(value["sector"]),
      city: this.text(value["city"]),
      goalArs: this.bigint(value["goal_ars"]),
      totalStroops: this.bigint(value["total_stroops"]),
      goalStroops: this.bigint(value["goal_stroops"]),
      state: this.campaignState(value["state"]),
      closeDate: this.text(value["deadline"]),
      vaultAddress: this.text(value["contract_address"]),
      hasImage: this.imageDescriptor(value) !== undefined,
      contributorsCount: this.count(value["contributors_count"]),
      ...(rateSnapshot === undefined ? {} : { rateSnapshot })
    };
  }

  private toDistribution(row: unknown): MyCampaignDistributionRecord {
    const value = this.asRecord(row);
    return {
      campaignId: this.text(value["campaign_id"]),
      distributionId: this.text(value["distribution_id"]),
      period: this.optionalText(value["period"]),
      amountStroops: this.bigint(value["amount_stroops"]),
      state: this.distributionState(value["state"])
    };
  }

  private toSales(row: unknown): MyCampaignSalesRecord {
    const value = this.asRecord(row);
    return {
      campaignId: this.text(value["campaign_id"]),
      period: this.text(value["period"]),
      salesArs: this.optionalBigint(value["sales_ars"]),
      status: this.salesStatus(value["status"])
    };
  }

  /**
   * Maps the view's image columns. The view emits the two columns all-or-none
   * from one lateral row, so a partially-written pair (which the view cannot
   * produce) throws rather than half-mapping; an unexpected content type also
   * throws, because the view constrains it to `image/jpeg`/`image/png`.
   */
  private imageDescriptor(value: Record<string, unknown>): string | undefined {
    const objectPath = value["image_object_path"];
    const contentType = value["image_content_type"];
    const pathAbsent = objectPath === null || objectPath === undefined;
    const typeAbsent = contentType === null || contentType === undefined;

    if (pathAbsent && typeAbsent) return undefined;
    if (typeof objectPath !== "string" || objectPath.length === 0) {
      throw new Error("Malformed image object path");
    }
    if (typeof contentType !== "string" || !IMAGE_CONTENT_TYPES.includes(contentType)) {
      throw new Error("Malformed image content type");
    }
    return objectPath;
  }

  /**
   * The three snapshot columns are all-or-none at the schema level, so their
   * absence is read from `fx_rate_version` alone and a partially-written row
   * (which the constraint forbids) throws rather than half-mapping.
   */
  private toRateSnapshot(value: Record<string, unknown>): MyCampaignRateSnapshot | undefined {
    if (value["fx_rate_version"] === null || value["fx_rate_version"] === undefined) return undefined;
    return {
      usdToArs: this.bigint(value["usd_to_ars"]),
      stroopsPerUsd: this.bigint(value["stroops_per_usd"])
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

  /** A non-negative integer count, safe as a JS number. */
  private count(value: unknown): number {
    const parsed = this.bigint(value);
    if (parsed < 0n || parsed > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Malformed count column");
    return Number(parsed);
  }

  private campaignState(value: unknown): MyCampaignRepositoryState {
    if (typeof value === "string" && CAMPAIGN_STATES.includes(value as MyCampaignRepositoryState)) {
      return value as MyCampaignRepositoryState;
    }
    throw new Error("Malformed campaign state");
  }

  private distributionState(value: unknown): MyCampaignDistributionRecord["state"] {
    if (typeof value === "string" && DISTRIBUTION_STATES.includes(value as MyCampaignDistributionRecord["state"])) {
      return value as MyCampaignDistributionRecord["state"];
    }
    throw new Error("Malformed distribution state");
  }

  private salesStatus(value: unknown): MyCampaignSalesRecord["status"] {
    if (typeof value === "string" && SALES_STATUSES.includes(value as MyCampaignSalesRecord["status"])) {
      return value as MyCampaignSalesRecord["status"];
    }
    throw new Error("Malformed sales status");
  }

  private toError(error: PostgrestError): { readonly code: "unavailable" } {
    // PII, rows and PostgREST's message/details/hint never enter diagnostics.
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to a caller
    console.error("[SupabaseMyCampaignsRepository] persistence error", { code: error.code });
    return { code: "unavailable" };
  }
}
