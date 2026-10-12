import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type {
  OperatorProfileWriterPort,
  OperatorProfileWriterResult
} from "../../application/ports/operator-profile-writer-port.js";

/**
 * The Supabase operator profile writer (#390/WU5).
 *
 * Writes `public.profile.display_name` as `service_role`, scoped to the target
 * user id the caller supplies (always the verified principal's own id). It is
 * the single enforcement point for this write, so every provider failure and
 * every thrown error collapses to the sanitized `unavailable` — the provider's
 * `message`/`details`/`hint` never cross this boundary, and a broken adapter can
 * never surface as a 500. A write that matches no row is `not_found`.
 */

const PROFILE_TABLE = "profile";
const KEY_COLUMN = "user_id";

const NOT_FOUND: OperatorProfileWriterResult = { ok: false, error: { code: "not_found" } };
const UNAVAILABLE: OperatorProfileWriterResult = { ok: false, error: { code: "unavailable" } };

export class SupabaseOperatorProfileWriter implements OperatorProfileWriterPort {
  constructor(private readonly client: SupabaseClient) {}

  async setDisplayName(userId: string, displayName: string): Promise<OperatorProfileWriterResult> {
    try {
      const { data, error } = await this.client
        .from(PROFILE_TABLE)
        .update({ display_name: displayName })
        .eq(KEY_COLUMN, userId)
        .select(KEY_COLUMN);

      if (error) {
        this.logProvider(error);
        return UNAVAILABLE;
      }
      if (!Array.isArray(data)) {
        this.logUnexpected(new Error("update without a returned row set"));
        return UNAVAILABLE;
      }

      // No matched row: the profile was deleted between the read and the write.
      return data.length > 0 ? { ok: true, value: undefined } : NOT_FOUND;
    } catch (cause) {
      this.logUnexpected(cause);
      return UNAVAILABLE;
    }
  }

  private logProvider(error: PostgrestError): void {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error("[SupabaseOperatorProfileWriter] setDisplayName error", { code: error.code });
  }

  private logUnexpected(cause: unknown): void {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error("[SupabaseOperatorProfileWriter] setDisplayName failed", {
      cause: cause instanceof Error ? cause.name : "unknown"
    });
  }
}
