import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import {
  CAMPAIGN_DURATION_DAYS,
  type BusinessDraft,
  type BusinessRecord,
  type BusinessRepositoryError,
  type BusinessRepositoryPort,
  type BusinessRepositoryResult
} from "../../application/ports/business-repository-port.js";

/**
 * The Supabase adapter for the PyME company model (Feature #398, Task #399 /
 * T3b). The API connects as `service_role`, which bypasses the table's RLS, so
 * every read here is scoped by `owner_user_id` and is the single ownership
 * enforcement point.
 *
 * Failures collapse to a sanitized code; Postgres's `message`/`details`/`hint`
 * are logged server-side and never cross this boundary.
 */

const TABLE = "businesses";
const POSTGRES_CHECK_VIOLATION = "23514";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface BusinessColumns {
  readonly id?: unknown;
  readonly owner_user_id?: unknown;
  readonly name?: unknown;
  readonly cuit?: unknown;
  readonly sector?: unknown;
  readonly city?: unknown;
  readonly description?: unknown;
  readonly goal_ars?: unknown;
  readonly revenue_share?: unknown;
  readonly deadline?: unknown;
  readonly campaign_duration_days?: unknown;
  readonly created_at?: unknown;
  readonly updated_at?: unknown;
}

export class SupabaseBusinessRepository implements BusinessRepositoryPort {
  constructor(private readonly client: SupabaseClient) {}

  async createForOwner(input: {
    readonly ownerUserId: string;
    readonly draft: BusinessDraft;
  }): Promise<BusinessRepositoryResult<BusinessRecord>> {
    try {
      const { data, error } = await this.client
        .from(TABLE)
        .insert({
          owner_user_id: input.ownerUserId,
          name: input.draft.name,
          cuit: input.draft.cuit,
          sector: input.draft.sector,
          city: input.draft.city,
          description: input.draft.description,
          goal_ars: input.draft.goalArs,
          revenue_share: input.draft.revenueShare,
          // Absent when the draft carries no deadline: omitting the column
          // leaves it NULL, exactly as an explicit `null` would.
          ...(input.draft.deadline === undefined || input.draft.deadline === null
            ? {}
            : { deadline: input.draft.deadline }),
          ...(input.draft.campaignDurationDays === undefined || input.draft.campaignDurationDays === null
            ? {}
            : { campaign_duration_days: input.draft.campaignDurationDays })
        })
        .select()
        .single();

      if (error) {
        return { ok: false, error: this.toRepositoryError(error) };
      }
      if (!data) {
        return { ok: false, error: { code: "unavailable" } };
      }

      return { ok: true, value: this.toRecord(data as BusinessColumns) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async findByOwner(ownerUserId: string): Promise<BusinessRepositoryResult<BusinessRecord>> {
    return this.findScoped([["owner_user_id", ownerUserId]]);
  }

  async findOwnedById(input: {
    readonly ownerUserId: string;
    readonly businessId: string;
  }): Promise<BusinessRepositoryResult<BusinessRecord>> {
    // A value that cannot be a primary key can never match an owned row, so it
    // is `not_found` rather than a Postgres cast error the caller cannot act on.
    if (!UUID_PATTERN.test(input.businessId)) {
      return { ok: false, error: { code: "not_found" } };
    }

    return this.findScoped([
      ["id", input.businessId],
      ["owner_user_id", input.ownerUserId]
    ]);
  }

  private async findScoped(
    filters: ReadonlyArray<readonly [string, unknown]>
  ): Promise<BusinessRepositoryResult<BusinessRecord>> {
    try {
      let query = this.client.from(TABLE).select();
      for (const [column, value] of filters) {
        query = query.eq(column, value);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        return { ok: false, error: this.toRepositoryError(error) };
      }
      if (!data) {
        return { ok: false, error: { code: "not_found" } };
      }

      return { ok: true, value: this.toRecord(data as BusinessColumns) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  /**
   * Rebuilds a stored row, refusing anything malformed so a corrupt read becomes
   * `unavailable` rather than a half-populated company.
   */
  private toRecord(row: BusinessColumns): BusinessRecord {
    const businessId = row.id;
    const ownerUserId = row.owner_user_id;
    const createdAt = row.created_at;
    const updatedAt = row.updated_at;
    // Nullable: a business registered before the deadline column, or without a
    // declared one, stores NULL and is read back with the field omitted.
    const deadline = row.deadline;

    if (
      typeof businessId !== "string" ||
      typeof ownerUserId !== "string" ||
      typeof row.name !== "string" ||
      typeof row.cuit !== "string" ||
      typeof row.sector !== "string" ||
      typeof row.city !== "string" ||
      typeof row.description !== "string" ||
      typeof createdAt !== "string" ||
      typeof updatedAt !== "string"
    ) {
      throw new Error("malformed business row");
    }

    const goalArs = this.normalizeInteger(row.goal_ars);
    const revenueShare = this.normalizeNumber(row.revenue_share);

    if (goalArs === undefined || revenueShare === undefined) {
      throw new Error("malformed business row");
    }

    if (deadline !== undefined && deadline !== null && typeof deadline !== "string") {
      throw new Error("malformed business row");
    }

    // Nullable (#410/U13): anything but NULL or one of the three durations the
    // column's CHECK allows is a malformed row, never a guessed duration.
    const duration = row.campaign_duration_days;
    const campaignDurationDays = CAMPAIGN_DURATION_DAYS.find((days) => days === duration);
    if (duration !== undefined && duration !== null && campaignDurationDays === undefined) {
      throw new Error("malformed business row");
    }

    return {
      businessId,
      ownerUserId,
      name: row.name,
      cuit: row.cuit,
      sector: row.sector,
      city: row.city,
      description: row.description,
      goalArs,
      revenueShare,
      ...(typeof deadline === "string" ? { deadline } : {}),
      ...(campaignDurationDays === undefined ? {} : { campaignDurationDays }),
      createdAt,
      updatedAt
    };
  }

  private normalizeInteger(value: unknown): number | undefined {
    if (typeof value === "number") {
      return Number.isSafeInteger(value) ? value : undefined;
    }
    if (typeof value === "string" && /^-?\d+$/.test(value)) {
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) ? parsed : undefined;
    }
    return undefined;
  }

  private normalizeNumber(value: unknown): number | undefined {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value)) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }

  private toRepositoryError(error: PostgrestError): BusinessRepositoryError {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error("[SupabaseBusinessRepository] persistence error", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    });

    return error.code === POSTGRES_CHECK_VIOLATION ? { code: "invalid_request" } : { code: "unavailable" };
  }
}
