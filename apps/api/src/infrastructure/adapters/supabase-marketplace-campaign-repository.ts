import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { RiskBand } from "@vaqcrow/contracts";
import type {
  MarketplaceCampaignImageRecord,
  MarketplaceCampaignRateSnapshot,
  MarketplaceCampaignRecord,
  MarketplaceCampaignRepositoryPort,
  MarketplaceCampaignRepositoryResult
} from "../../application/ports/marketplace-campaign-repository-port.js";

const MARKETPLACE_VIEW = "marketplace_campaign";
const RISK_BANDS: readonly RiskBand[] = ["low", "medium", "high"];
/** The only content types the view exposes as a card image (#414/WU3). */
const IMAGE_CONTENT_TYPES: readonly string[] = ["image/jpeg", "image/png"];
const NUMERIC_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

/**
 * Reads the joined `marketplace_campaign` view (one row per published,
 * confirmed campaign). The view already applies the published filter, so the
 * adapter cannot list an unpublished campaign by omission; it only maps the
 * row's text/numeric columns back to typed records.
 *
 * PostgREST returns `bigint` as a decimal string and `numeric` as a JSON number
 * (a string form is also legal), so both are normalized here. A malformed row
 * throws and is caught as `unavailable`; the provider's
 * message/details/hint never reach the caller.
 */
export class SupabaseMarketplaceCampaignRepository implements MarketplaceCampaignRepositoryPort {
  constructor(private readonly client: SupabaseClient) {}

  async listPublished(): Promise<MarketplaceCampaignRepositoryResult<readonly MarketplaceCampaignRecord[]>> {
    try {
      const { data, error } = await this.client
        .from(MARKETPLACE_VIEW)
        .select("*")
        .order("deadline", { ascending: true });

      if (error) return { ok: false, error: this.toError(error) };
      if (!Array.isArray(data)) throw new Error("Malformed marketplace read");

      return { ok: true, value: data.map((row) => this.toRecord(row)) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async findPublishedImage(
    campaignId: string
  ): Promise<MarketplaceCampaignRepositoryResult<MarketplaceCampaignImageRecord | undefined>> {
    try {
      const { data, error } = await this.client
        .from(MARKETPLACE_VIEW)
        .select("image_object_path,image_content_type")
        .eq("campaign_id", campaignId)
        .maybeSingle();

      if (error) return { ok: false, error: this.toError(error) };
      // No row means the campaign is not published (or does not exist); a row
      // with a null image path means the PyME has no image document. Both are
      // `undefined`, which the use case maps to a 404.
      if (data === null || data === undefined) return { ok: true, value: undefined };

      return { ok: true, value: this.imageDescriptor(this.asRecord(data)) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  private toRecord(row: unknown): MarketplaceCampaignRecord {
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
      revenueShare: this.number(value["revenue_share"]),
      riskBand: this.riskBand(value["risk_band"]),
      riskConfidence: this.optionalNumber(value["risk_confidence"]),
      closeDate: this.text(value["deadline"]),
      hasImage: this.imageDescriptor(value) !== undefined,
      ...(rateSnapshot === undefined ? {} : { rateSnapshot })
    };
  }

  /**
   * Maps the view's image columns. The view emits the two columns all-or-none
   * from one lateral row, so a partially-written pair (which the view cannot
   * produce) throws rather than half-mapping; an unexpected content type also
   * throws, because the view constrains it to `image/jpeg`/`image/png`.
   */
  private imageDescriptor(value: Record<string, unknown>): MarketplaceCampaignImageRecord | undefined {
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
    return { objectPath, contentType };
  }

  /**
   * The three snapshot columns are all-or-none at the schema level, so their
   * absence is read from `fx_rate_version` alone and a partially-written row
   * (which the constraint forbids) throws rather than half-mapping.
   */
  private toRateSnapshot(value: Record<string, unknown>): MarketplaceCampaignRateSnapshot | undefined {
    if (value["fx_rate_version"] === null || value["fx_rate_version"] === undefined) return undefined;
    return {
      version: this.integer(value["fx_rate_version"]),
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

  private bigint(value: unknown): bigint {
    if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
    if (typeof value === "string" && /^-?(?:0|[1-9]\d*)$/.test(value)) return BigInt(value);
    throw new Error("Malformed bigint column");
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

  private optionalNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    return this.number(value);
  }

  /** A snapshot version is small enough to map to a JS number. */
  private integer(value: unknown): number {
    if (typeof value === "number" && Number.isSafeInteger(value)) return value;
    if (typeof value === "string" && /^-?(?:0|[1-9]\d*)$/.test(value)) {
      const parsed = Number(value);
      if (Number.isSafeInteger(parsed)) return parsed;
    }
    throw new Error("Malformed integer column");
  }

  private riskBand(value: unknown): RiskBand | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "string" && RISK_BANDS.includes(value as RiskBand)) return value as RiskBand;
    throw new Error("Malformed risk band");
  }

  private toError(error: PostgrestError): { readonly code: "unavailable" } {
    // PII, rows and PostgREST's message/details/hint never enter diagnostics.
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to a caller
    console.error("[SupabaseMarketplaceCampaignRepository] persistence error", { code: error.code });
    return { code: "unavailable" };
  }
}
