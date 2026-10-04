import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  WalletChallengeRecord,
  WalletRepositoryError,
  WalletRepositoryPort,
  WalletRepositoryResult
} from "../../application/ports/wallet-repository-port.js";

/**
 * The Supabase adapter for the PyME wallet boundary (Feature #406, Task #407 /
 * T1b). The API connects as `service_role`, which bypasses RLS on
 * `wallet_challenge` and `profile`, so every read and write here is scoped by
 * the owner the caller resolved from the verified token.
 *
 * `isFrozen` walks the ownership chain the schema defines:
 * `sme_request.owner_user_id = ?` → the owner's `application_id`s →
 * a `campaign` row for one of them. Before any campaign exists the key is
 * replaceable; after it is deployed the key is the vault's immutable
 * destination and a write is refused.
 *
 * Failures collapse to a sanitized code; Postgres `message`/`details`/`hint`
 * are logged server-side and never cross this boundary. A `CHECK` violation is
 * the one code mapped to `invalid_request` (matching the other repositories);
 * everything else is `unavailable`.
 */

const CHALLENGE_TABLE = "wallet_challenge";
const PROFILE_TABLE = "profile";
const SME_REQUEST_TABLE = "sme_request";
const CAMPAIGN_TABLE = "campaign";

const POSTGRES_CHECK_VIOLATION = "23514";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUBLIC_KEY_PATTERN = /^G[A-Z2-7]{55}$/;

interface ChallengeColumns {
  readonly challenge_id?: unknown;
  readonly owner_user_id?: unknown;
  readonly nonce?: unknown;
  readonly expires_at?: unknown;
  readonly consumed_at?: unknown;
}

interface ProfileColumns {
  readonly stellar_public_key?: unknown;
}

export class SupabaseWalletRepository implements WalletRepositoryPort {
  constructor(private readonly client: SupabaseClient) {}

  async createChallenge(input: {
    readonly challengeId: string;
    readonly ownerUserId: string;
    readonly nonce: string;
    readonly expiresAt: string;
  }): Promise<WalletRepositoryResult<WalletChallengeRecord>> {
    try {
      const { data, error } = await this.client
        .from(CHALLENGE_TABLE)
        .insert({
          challenge_id: input.challengeId,
          owner_user_id: input.ownerUserId,
          nonce: input.nonce,
          expires_at: input.expiresAt
        })
        .select()
        .single();

      if (error) {
        return this.failure(error);
      }
      if (!data) {
        return this.unavailable();
      }

      return { ok: true, value: this.toChallenge(data as ChallengeColumns) };
    } catch {
      return this.unavailable();
    }
  }

  async findChallenge(input: {
    readonly challengeId: string;
    readonly ownerUserId: string;
  }): Promise<WalletRepositoryResult<WalletChallengeRecord>> {
    // A value that cannot be a primary key can never match, so it is
    // `not_found` rather than a Postgres cast error the caller cannot act on.
    if (!UUID_PATTERN.test(input.challengeId)) {
      return { ok: false, error: { code: "not_found" } };
    }

    try {
      const { data, error } = await this.client
        .from(CHALLENGE_TABLE)
        .select()
        .eq("challenge_id", input.challengeId)
        .eq("owner_user_id", input.ownerUserId)
        .maybeSingle();

      if (error) {
        return this.failure(error);
      }
      if (!data) {
        return { ok: false, error: { code: "not_found" } };
      }

      return { ok: true, value: this.toChallenge(data as ChallengeColumns) };
    } catch {
      return this.unavailable();
    }
  }

  async consumeChallenge(challengeId: string): Promise<WalletRepositoryResult<void>> {
    if (!UUID_PATTERN.test(challengeId)) {
      return { ok: false, error: { code: "not_found" } };
    }

    try {
      const { data, error } = await this.client
        .from(CHALLENGE_TABLE)
        .update({ consumed_at: new Date().toISOString() })
        .eq("challenge_id", challengeId)
        .is("consumed_at", null)
        .select();

      if (error) {
        return this.failure(error);
      }
      // Zero rows means it was already consumed (or vanished): a replay.
      if (!Array.isArray(data) || data.length === 0) {
        return { ok: false, error: { code: "not_found" } };
      }

      return { ok: true, value: undefined };
    } catch {
      return this.unavailable();
    }
  }

  async readPublicKey(ownerUserId: string): Promise<WalletRepositoryResult<string | null>> {
    try {
      const { data, error } = await this.client
        .from(PROFILE_TABLE)
        .select("stellar_public_key")
        .eq("user_id", ownerUserId)
        .maybeSingle();

      if (error) {
        return this.failure(error);
      }
      if (!data) {
        // The auth layer guarantees a profile; a missing row reads as "no key".
        return { ok: true, value: null };
      }

      const value = (data as ProfileColumns).stellar_public_key;
      if (value === null || value === undefined) {
        return { ok: true, value: null };
      }
      if (typeof value !== "string" || !PUBLIC_KEY_PATTERN.test(value)) {
        throw new Error("malformed stored stellar_public_key");
      }

      return { ok: true, value };
    } catch {
      return this.unavailable();
    }
  }

  async writePublicKey(input: {
    readonly ownerUserId: string;
    readonly publicKey: string;
  }): Promise<WalletRepositoryResult<void>> {
    try {
      const { data, error } = await this.client
        .from(PROFILE_TABLE)
        .update({ stellar_public_key: input.publicKey })
        .eq("user_id", input.ownerUserId)
        .select()
        .single();

      if (error) {
        return this.failure(error);
      }
      if (!data) {
        return { ok: false, error: { code: "not_found" } };
      }

      return { ok: true, value: undefined };
    } catch {
      return this.unavailable();
    }
  }

  async isFrozen(ownerUserId: string): Promise<WalletRepositoryResult<boolean>> {
    try {
      const applications = await this.client
        .from(SME_REQUEST_TABLE)
        .select("application_id")
        .eq("owner_user_id", ownerUserId);

      if (applications.error) {
        return this.failure(applications.error);
      }

      const rows = Array.isArray(applications.data) ? applications.data : [];
      const applicationIds = rows
        .map((row) => (row as Record<string, unknown>)["application_id"])
        .filter((id): id is string => typeof id === "string");

      if (applicationIds.length === 0) {
        return { ok: true, value: false };
      }

      const campaigns = await this.client
        .from(CAMPAIGN_TABLE)
        .select("campaign_id")
        .in("application_id", applicationIds)
        .limit(1);

      if (campaigns.error) {
        return this.failure(campaigns.error);
      }

      return { ok: true, value: Array.isArray(campaigns.data) && campaigns.data.length > 0 };
    } catch {
      return this.unavailable();
    }
  }

  /** Rebuilds a challenge row, refusing a malformed one as `unavailable`. */
  private toChallenge(row: ChallengeColumns): WalletChallengeRecord {
    const challengeId = row.challenge_id;
    const ownerUserId = row.owner_user_id;
    const nonce = row.nonce;
    const expiresAt = row.expires_at;
    const consumedAt = row.consumed_at;

    if (
      typeof challengeId !== "string" ||
      typeof ownerUserId !== "string" ||
      typeof nonce !== "string" ||
      typeof expiresAt !== "string" ||
      (consumedAt !== null && typeof consumedAt !== "string")
    ) {
      throw new Error("malformed wallet challenge row");
    }

    return {
      challengeId,
      ownerUserId,
      nonce,
      expiresAt,
      consumedAt: consumedAt ?? null
    };
  }

  private failure(error: PostgrestError): WalletRepositoryResult<never> {
    return { ok: false, error: this.toError(error) };
  }

  private toError(error: PostgrestError): WalletRepositoryError {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error("[SupabaseWalletRepository] persistence error", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    });

    return error.code === POSTGRES_CHECK_VIOLATION ? { code: "invalid_request" } : { code: "unavailable" };
  }

  private unavailable(): WalletRepositoryResult<never> {
    return { ok: false, error: { code: "unavailable" } };
  }
}
