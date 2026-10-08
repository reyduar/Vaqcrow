import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  FavoriteRepositoryPort,
  FavoriteRepositoryResult
} from "../../application/ports/favorite-repository-port.js";

/**
 * Supabase adapter for per-account favorites (#414/WU2).
 *
 * The API connects as `service_role`, so every read/write here bypasses RLS and
 * is the single enforcement point; the caller's `userId` comes from the verified
 * principal and always scopes the query. Two Postgres errors are control flow,
 * not failures: `23505` (unique violation) means the favorite already exists, so
 * `add` is idempotent, and `23503` (foreign-key violation) means the campaign
 * does not exist, so `add` is `not_found`. Every other error is logged with its
 * `code`/`message`/`details`/`hint` for operators and returned as a sanitized
 * `unavailable` — provider text never crosses this boundary.
 */

const FAVORITE_TABLE = "campaign_favorite";
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

interface FavoriteColumns {
  readonly campaign_id?: unknown;
}

export class SupabaseFavoriteRepository implements FavoriteRepositoryPort {
  constructor(private readonly client: SupabaseClient) {}

  async listCampaignIds(userId: string): Promise<FavoriteRepositoryResult<readonly string[]>> {
    try {
      const { data, error } = await this.client
        .from(FAVORITE_TABLE)
        .select("campaign_id")
        .eq("user_id", userId);

      if (error) {
        this.logProviderError("listCampaignIds", error);
        return { ok: false, error: { code: "unavailable" } };
      }

      const rows = Array.isArray(data) ? (data as FavoriteColumns[]) : [];
      const campaignIds: string[] = [];
      for (const row of rows) {
        const campaignId = row.campaign_id;
        if (typeof campaignId !== "string" || campaignId.length === 0) {
          this.logUnexpected("listCampaignIds", new Error("malformed favorite row"));
          return { ok: false, error: { code: "unavailable" } };
        }
        campaignIds.push(campaignId);
      }
      return { ok: true, value: campaignIds };
    } catch (cause) {
      this.logUnexpected("listCampaignIds", cause);
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async add(userId: string, campaignId: string): Promise<FavoriteRepositoryResult<{ readonly applied: boolean }>> {
    try {
      const { error } = await this.client
        .from(FAVORITE_TABLE)
        .insert({ user_id: userId, campaign_id: campaignId });

      if (error) {
        return this.toAddError(error);
      }

      return { ok: true, value: { applied: true } };
    } catch (cause) {
      this.logUnexpected("add", cause);
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async remove(userId: string, campaignId: string): Promise<FavoriteRepositoryResult<{ readonly applied: boolean }>> {
    try {
      const { data, error } = await this.client
        .from(FAVORITE_TABLE)
        .delete()
        .eq("user_id", userId)
        .eq("campaign_id", campaignId)
        .select("campaign_id");

      if (error) {
        this.logProviderError("remove", error);
        return { ok: false, error: { code: "unavailable" } };
      }

      return { ok: true, value: { applied: Array.isArray(data) && data.length > 0 } };
    } catch (cause) {
      this.logUnexpected("remove", cause);
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  /**
   * Maps `insert`'s error: a unique violation is an idempotent "already saved",
   * a foreign-key violation is an unknown campaign, and anything else is
   * `unavailable`. The first two are expected outcomes, so they are not logged.
   */
  private toAddError(error: PostgrestError): FavoriteRepositoryResult<{ readonly applied: boolean }> {
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: true, value: { applied: false } };
    }
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return { ok: false, error: { code: "not_found" } };
    }
    this.logProviderError("add", error);
    return { ok: false, error: { code: "unavailable" } };
  }

  private logProviderError(operation: string, error: PostgrestError): void {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error(`[SupabaseFavoriteRepository] ${operation} error`, {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    });
  }

  private logUnexpected(operation: string, cause: unknown): void {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error(`[SupabaseFavoriteRepository] ${operation} threw`, {
      cause: cause instanceof Error ? cause.name : "unknown"
    });
  }
}
