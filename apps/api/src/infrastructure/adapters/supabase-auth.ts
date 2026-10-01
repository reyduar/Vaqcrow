import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthPort, AuthResult, Principal, Role } from "../../application/ports/auth-port.js";

const PROFILE_TABLE = "profile";
const ROLES: readonly string[] = ["PYME", "INVERSOR", "ADMIN"];

interface ProfileRow {
  readonly user_id?: unknown;
  readonly role?: unknown;
  readonly status?: unknown;
  readonly display_name?: unknown;
}

const UNAUTHENTICATED = { ok: false, error: { code: "unauthenticated" } } as const;
const UNAVAILABLE = { ok: false, error: { code: "unavailable" } } as const;

/**
 * Resolves a bearer token to a principal.
 *
 * The token is validated by Supabase Auth (`getUser` calls the Auth server, so
 * signature, expiry and revocation are checked there); the role is then read
 * from `profile` with the service-role client. No claim of the unverified JWT
 * is ever used.
 */
export class SupabaseAuth implements AuthPort {
  constructor(private readonly client: SupabaseClient) {}

  async verifyAccessToken(token: string): Promise<AuthResult<Principal>> {
    try {
      const { data, error } = await this.client.auth.getUser(token);

      if (error) {
        // 4xx (except rate limiting) = the token is not acceptable; anything else is the provider failing.
        const status = typeof error.status === "number" ? error.status : undefined;
        if (status !== undefined && status >= 400 && status < 500 && status !== 429) {
          return UNAUTHENTICATED;
        }
        this.log("token verification failed", { status, name: error.name });
        return UNAVAILABLE;
      }

      if (!data.user) {
        return UNAUTHENTICATED;
      }

      const profile = await this.client
        .from(PROFILE_TABLE)
        .select("user_id, role, status, display_name")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (profile.error) {
        this.log("profile read failed", {
          code: profile.error.code,
          message: profile.error.message,
          details: profile.error.details,
          hint: profile.error.hint
        });
        return UNAVAILABLE;
      }

      if (!profile.data) {
        return UNAUTHENTICATED;
      }

      const row = profile.data as ProfileRow;
      if (
        typeof row.user_id !== "string" ||
        typeof row.role !== "string" ||
        !ROLES.includes(row.role) ||
        (row.status !== "active" && row.status !== "inactive") ||
        typeof row.display_name !== "string"
      ) {
        this.log("malformed profile row", {});
        return UNAVAILABLE;
      }

      return {
        ok: true,
        value: {
          userId: row.user_id,
          role: row.role as Role,
          status: row.status,
          displayName: row.display_name
        }
      };
    } catch {
      this.log("unexpected failure", {});
      return UNAVAILABLE;
    }
  }

  private log(event: string, context: Record<string, unknown>): void {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error(`[SupabaseAuth] ${event}`, context);
  }
}
