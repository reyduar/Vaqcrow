import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  ReportContributionRecord,
  ReportDistributionRecord,
  ReportsRepositoryPort,
  ReportsRepositoryResult,
  ReportSalesByPymeRecord,
  ReportSalesStatus
} from "../../application/ports/reports-repository-port.js";

/**
 * The investor report read adapter (#430, WU1).
 *
 * Reads three service_role-only, `security_invoker` views, always filtered by
 * the caller-resolved `investor_account_id`, so it can never read another
 * account's rows:
 *   * `investor_report_contribution` — one row per contribution, with the
 *     `observed_at` approximation (`coalesce(last_observed_at, created_at)`).
 *   * `investor_report_distribution` — one row per distribution recipient, with
 *     the persisted state, the confirmation time and the PyME's declared sale
 *     for that period.
 *   * `investor_report_sales_by_pyme` — one row per declared-sales month of a
 *     PyME the investor holds a position in.
 *
 * A malformed row or a provider error is `unavailable`; PostgREST's
 * message/details/hint never cross this boundary.
 */

const CONTRIBUTION_VIEW = "investor_report_contribution";
const DISTRIBUTION_VIEW = "investor_report_distribution";
const SALES_VIEW = "investor_report_sales_by_pyme";

const DISTRIBUTION_STATES: readonly ReportDistributionRecord["state"][] = ["submitted", "confirmed", "failed"];
const SALES_STATUSES: readonly ReportSalesStatus[] = ["reported", "missing", "anomalous"];

export class SupabaseReportsRepository implements ReportsRepositoryPort {
  constructor(private readonly client: SupabaseClient) {}

  async listContributions(
    investorAccountId: string
  ): Promise<ReportsRepositoryResult<readonly ReportContributionRecord[]>> {
    try {
      const { data, error } = await this.client
        .from(CONTRIBUTION_VIEW)
        .select("*")
        .eq("investor_account_id", investorAccountId)
        .order("observed_at", { ascending: true });

      if (error) return { ok: false, error: this.toError(error) };
      if (!Array.isArray(data)) throw new Error("Malformed reports read");

      return { ok: true, value: data.map((row) => this.toContribution(row)) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async listDistributions(
    investorAccountId: string
  ): Promise<ReportsRepositoryResult<readonly ReportDistributionRecord[]>> {
    try {
      const { data, error } = await this.client
        .from(DISTRIBUTION_VIEW)
        .select("*")
        .eq("investor_account_id", investorAccountId)
        .order("recorded_at", { ascending: false });

      if (error) return { ok: false, error: this.toError(error) };
      if (!Array.isArray(data)) throw new Error("Malformed reports read");

      return { ok: true, value: data.map((row) => this.toDistribution(row)) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async listSalesByPyme(
    investorAccountId: string
  ): Promise<ReportsRepositoryResult<readonly ReportSalesByPymeRecord[]>> {
    try {
      const { data, error } = await this.client
        .from(SALES_VIEW)
        .select("*")
        .eq("investor_account_id", investorAccountId)
        .order("name", { ascending: true })
        .order("period", { ascending: true });

      if (error) return { ok: false, error: this.toError(error) };
      if (!Array.isArray(data)) throw new Error("Malformed reports read");

      return { ok: true, value: data.map((row) => this.toSalesByPyme(row)) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  private toContribution(row: unknown): ReportContributionRecord {
    const value = this.asRecord(row);
    return {
      campaignId: this.text(value["campaign_id"]),
      contributionStroops: this.bigint(value["contribution_stroops"]),
      observedAt: this.text(value["observed_at"])
    };
  }

  private toDistribution(row: unknown): ReportDistributionRecord {
    const value = this.asRecord(row);
    return {
      distributionId: this.text(value["distribution_id"]),
      campaignId: this.optionalText(value["campaign_id"]),
      campaignName: this.optionalText(value["campaign_name"]),
      period: this.optionalText(value["period"]),
      amountStroops: this.bigint(value["amount_stroops"]),
      state: this.distributionState(value["state"]),
      confirmedAt: this.optionalText(value["confirmed_at"]),
      recordedAt: this.text(value["recorded_at"]),
      declaredSalesArs: this.optionalBigint(value["declared_sales_ars"])
    };
  }

  private toSalesByPyme(row: unknown): ReportSalesByPymeRecord {
    const value = this.asRecord(row);
    return {
      campaignId: this.text(value["campaign_id"]),
      name: this.text(value["name"]),
      sector: this.text(value["sector"]),
      period: this.text(value["period"]),
      salesArs: this.optionalBigint(value["sales_ars"]),
      status: this.salesStatus(value["status"])
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

  private distributionState(value: unknown): ReportDistributionRecord["state"] {
    if (typeof value === "string" && DISTRIBUTION_STATES.includes(value as ReportDistributionRecord["state"])) {
      return value as ReportDistributionRecord["state"];
    }
    throw new Error("Malformed distribution state");
  }

  private salesStatus(value: unknown): ReportSalesStatus {
    if (typeof value === "string" && SALES_STATUSES.includes(value as ReportSalesStatus)) {
      return value as ReportSalesStatus;
    }
    throw new Error("Malformed sales status");
  }

  private toError(error: PostgrestError): { readonly code: "unavailable" } {
    // PII, rows and PostgREST's message/details/hint never enter diagnostics.
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to a caller
    console.error("[SupabaseReportsRepository] persistence error", { code: error.code });
    return { code: "unavailable" };
  }
}
