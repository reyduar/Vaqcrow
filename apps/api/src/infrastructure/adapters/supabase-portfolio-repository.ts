import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  PortfolioCampaignState,
  PortfolioDistributionRecord,
  PortfolioPositionRecord,
  PortfolioRateSnapshot,
  PortfolioRepositoryPort,
  PortfolioRepositoryResult
} from "../../application/ports/portfolio-repository-port.js";

/**
 * The investor portfolio read adapter (#426, WU1).
 *
 * Reads the two service_role-only, `security_invoker` views:
 * `investor_portfolio_position` (one row per contribution to a deployed
 * campaign) and `investor_portfolio_distribution` (one row per distribution
 * recipient). The caller's `investorAccountId` comes from the verified
 * principal — the adapter only ever filters by it, so it can never read another
 * account's rows.
 *
 * A malformed row or a provider error is `unavailable`; PostgREST's
 * message/details/hint and the private object path never cross this boundary.
 */

const POSITION_VIEW = "investor_portfolio_position";
const DISTRIBUTION_VIEW = "investor_portfolio_distribution";
const CAMPAIGN_STATES: readonly PortfolioCampaignState[] = ["open", "settled", "refundable"];
const DISTRIBUTION_STATES: readonly PortfolioDistributionRecord["state"][] = ["submitted", "confirmed", "failed"];
/** The only content types the view exposes as an image (#414/WU3 predicate). */
const IMAGE_CONTENT_TYPES: readonly string[] = ["image/jpeg", "image/png"];

export class SupabasePortfolioRepository implements PortfolioRepositoryPort {
  constructor(private readonly client: SupabaseClient) {}

  async listPositions(
    investorAccountId: string
  ): Promise<PortfolioRepositoryResult<readonly PortfolioPositionRecord[]>> {
    try {
      const { data, error } = await this.client
        .from(POSITION_VIEW)
        .select("*")
        .eq("investor_account_id", investorAccountId)
        .order("deadline", { ascending: true });

      if (error) return { ok: false, error: this.toError(error) };
      if (!Array.isArray(data)) throw new Error("Malformed portfolio read");

      return { ok: true, value: data.map((row) => this.toPosition(row)) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async listDistributions(
    investorAccountId: string
  ): Promise<PortfolioRepositoryResult<readonly PortfolioDistributionRecord[]>> {
    try {
      const { data, error } = await this.client
        .from(DISTRIBUTION_VIEW)
        .select("*")
        .eq("investor_account_id", investorAccountId)
        .order("recorded_at", { ascending: false });

      if (error) return { ok: false, error: this.toError(error) };
      if (!Array.isArray(data)) throw new Error("Malformed portfolio read");

      return { ok: true, value: data.map((row) => this.toDistribution(row)) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  private toPosition(row: unknown): PortfolioPositionRecord {
    const value = this.asRecord(row);
    const rateSnapshot = this.toRateSnapshot(value);
    return {
      campaignId: this.text(value["campaign_id"]),
      name: this.text(value["name"]),
      sector: this.text(value["sector"]),
      city: this.text(value["city"]),
      contributionStroops: this.bigint(value["contribution_stroops"]),
      goalArs: this.bigint(value["goal_ars"]),
      totalStroops: this.bigint(value["total_stroops"]),
      goalStroops: this.bigint(value["goal_stroops"]),
      state: this.campaignState(value["state"]),
      closeDate: this.text(value["deadline"]),
      vaultAddress: this.text(value["contract_address"]),
      hasImage: this.imageDescriptor(value) !== undefined,
      ...(rateSnapshot === undefined ? {} : { rateSnapshot })
    };
  }

  private toDistribution(row: unknown): PortfolioDistributionRecord {
    const value = this.asRecord(row);
    return {
      distributionId: this.text(value["distribution_id"]),
      campaignId: this.optionalText(value["campaign_id"]),
      campaignName: this.optionalText(value["campaign_name"]),
      period: this.optionalText(value["period"]),
      amountStroops: this.bigint(value["amount_stroops"]),
      state: this.distributionState(value["state"])
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
  private toRateSnapshot(value: Record<string, unknown>): PortfolioRateSnapshot | undefined {
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

  private campaignState(value: unknown): PortfolioCampaignState {
    if (typeof value === "string" && CAMPAIGN_STATES.includes(value as PortfolioCampaignState)) {
      return value as PortfolioCampaignState;
    }
    throw new Error("Malformed campaign state");
  }

  private distributionState(value: unknown): PortfolioDistributionRecord["state"] {
    if (typeof value === "string" && DISTRIBUTION_STATES.includes(value as PortfolioDistributionRecord["state"])) {
      return value as PortfolioDistributionRecord["state"];
    }
    throw new Error("Malformed distribution state");
  }

  private toError(error: PostgrestError): { readonly code: "unavailable" } {
    // PII, rows and PostgREST's message/details/hint never enter diagnostics.
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to a caller
    console.error("[SupabasePortfolioRepository] persistence error", { code: error.code });
    return { code: "unavailable" };
  }
}
