import type { SupabaseClient } from "@supabase/supabase-js";
import { parseAdminUser } from "@vaqcrow/contracts";
import type {
  AdminUser,
  AdminUserKycStatus,
  AdminUserRole,
  AdminUsersPage,
  AdminUsersQuery,
  AdminUserStatus
} from "@vaqcrow/contracts";
import type {
  AdminUsersReadResult,
  AdminUsersReaderPort
} from "../../application/ports/admin-users-reader-port.js";

/**
 * The ADMIN users read adapter (Feature #390, WU2).
 *
 * One row per `public.profile`, composed with two other sources:
 *
 * - Supabase **Auth Admin** (`client.auth.admin.listUsers`) for `email`,
 *   `last_sign_in_at` → `lastActivityAt`, and `invited_at` / `email_confirmed_at`
 *   → the `invited` status;
 * - `public.investor_kyc` for the simulated KYC label (`user_id` means approved,
 *   because the investor's KYC row is written, auto-approved, on the first
 *   contribution and has no rejection state — the migration has no boolean).
 *
 * `role` and `status` filters, the `search` term (case-insensitive over
 * displayName/email) and the page slice are applied here, in memory, over the
 * full composed set: this is the demo scale where the whole `profile` table and
 * the whole auth user list fit comfortably in one read. That is a deliberate
 * limit, not a scalable design — a production build would push the filter and
 * the slice down into the source.
 *
 * Because the writable surface is the profile row, the listing is profile-driven:
 * a profile with no matching auth user, an auth user without an email, or any
 * malformed column is a sanitized `unavailable`, never a silently dropped row or
 * an invented value. PostgREST's and the Auth API's message/details/hint never
 * cross this boundary.
 */

const PROFILE_TABLE = "profile";
const KYC_TABLE = "investor_kyc";
const PROFILE_COLUMNS = "user_id, role, display_name, status, chat_enabled";
const KYC_COLUMNS = "user_id";
/** Supabase caps `perPage`; the loop below walks every page it returns. */
const AUTH_PAGE_SIZE = 1000;
/** A runaway guard so a provider that always returns a full page cannot loop forever. */
const MAX_AUTH_PAGES = 100;

const ROLES: readonly AdminUserRole[] = ["PYME", "INVERSOR", "ADMIN"];
const PROFILE_STATUSES: readonly ("active" | "inactive")[] = ["active", "inactive"];

interface ProfileRow {
  readonly userId: string;
  readonly role: AdminUserRole;
  readonly displayName: string;
  readonly status: "active" | "inactive";
  /** The per-user assistant access flag (#499, D9); off by default. */
  readonly chatEnabled: boolean;
}

interface AuthRow {
  readonly email: string | undefined;
  readonly lastSignInAt: string | undefined;
  readonly invitedAt: string | undefined;
  readonly emailConfirmedAt: string | undefined;
}

export class SupabaseAdminUsersReader implements AdminUsersReaderPort {
  constructor(private readonly client: SupabaseClient) {}

  async list(query: AdminUsersQuery, viewerUserId: string): Promise<AdminUsersReadResult> {
    try {
      const [profileRows, authUsers, kycRows] = await Promise.all([
        this.readProfiles(),
        this.readAuthUsers(),
        this.readKycUserIds()
      ]);

      const authById = new Map<string, AuthRow>();
      for (const user of authUsers) {
        if (typeof user.id !== "string" || user.id.length === 0) {
          throw new Error("malformed auth user id");
        }
        authById.set(user.id, {
          email: this.optionalText(user.email),
          lastSignInAt: this.optionalText(user.last_sign_in_at),
          invitedAt: this.optionalText(user.invited_at),
          emailConfirmedAt: this.optionalText(user.email_confirmed_at)
        });
      }

      const composed = profileRows.map((profile) => {
        const auth = authById.get(profile.userId);
        if (auth === undefined) throw new Error("profile without an auth user");
        return this.toAdminUser(profile, auth, kycRows.has(profile.userId), viewerUserId);
      });

      const filtered = this.filter(composed, query);
      const start = (query.page - 1) * query.pageSize;
      const items = filtered.slice(start, start + query.pageSize);

      const value: AdminUsersPage = {
        items,
        total: filtered.length,
        page: query.page,
        pageSize: query.pageSize
      };
      return { ok: true, value };
    } catch (cause) {
      // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
      console.error("[SupabaseAdminUsersReader] list failed", {
        cause: cause instanceof Error ? cause.name : "unknown"
      });
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  private async readProfiles(): Promise<readonly ProfileRow[]> {
    const { data, error } = await this.client.from(PROFILE_TABLE).select(PROFILE_COLUMNS);
    if (error) {
      this.logProvider("profile read", error);
      throw new Error("profile read failed");
    }
    if (!Array.isArray(data)) throw new Error("malformed profile read");

    return data.map((row) => {
      const value = this.asRecord(row);
      return {
        userId: this.text(value["user_id"]),
        role: this.role(value["role"]),
        displayName: this.text(value["display_name"]),
        status: this.profileStatus(value["status"]),
        chatEnabled: this.boolean(value["chat_enabled"])
      };
    });
  }

  private async readKycUserIds(): Promise<ReadonlySet<string>> {
    const { data, error } = await this.client.from(KYC_TABLE).select(KYC_COLUMNS);
    if (error) {
      this.logProvider("investor_kyc read", error);
      throw new Error("investor_kyc read failed");
    }
    if (!Array.isArray(data)) throw new Error("malformed investor_kyc read");

    return new Set(data.map((row) => this.text(this.asRecord(row)["user_id"])));
  }

  private async readAuthUsers(): Promise<readonly AuthUserColumns[]> {
    const users: AuthUserColumns[] = [];
    for (let page = 1; page <= MAX_AUTH_PAGES; page += 1) {
      const { data, error } = await this.client.auth.admin.listUsers({ page, perPage: AUTH_PAGE_SIZE });
      if (error) {
        this.logProvider("auth listUsers", error);
        throw new Error("auth listUsers failed");
      }
      const batch = Array.isArray(data?.users) ? (data.users as readonly AuthUserColumns[]) : [];
      users.push(...batch);
      if (batch.length < AUTH_PAGE_SIZE) return users;
    }
    throw new Error("auth user listing exceeded the page cap");
  }

  private toAdminUser(
    profile: ProfileRow,
    auth: AuthRow,
    hasKycRow: boolean,
    viewerUserId: string
  ): AdminUser {
    if (auth.email === undefined) throw new Error("auth user without an email");

    // The contract parser is the single shape validator: a malformed email,
    // date or enum fails the read instead of leaking a half-typed row.
    return parseAdminUser({
      userId: profile.userId,
      displayName: profile.displayName,
      email: auth.email,
      role: profile.role,
      status: this.userStatus(profile.status, auth),
      lastActivityAt: auth.lastSignInAt ?? null,
      kycStatus: this.kycStatus(profile.role, hasKycRow),
      isSelf: profile.userId === viewerUserId,
      chatEnabled: profile.chatEnabled
    });
  }

  /** `invited` until the invitation is accepted; otherwise the stored status. */
  private userStatus(profileStatus: "active" | "inactive", auth: AuthRow): AdminUserStatus {
    return auth.invitedAt !== undefined && auth.emailConfirmedAt === undefined
      ? "invited"
      : profileStatus;
  }

  /**
   * KYC exists only for investors and is auto-approved at the first
   * contribution, so a row means approved; other roles are never verified
   * (the committed contract comment defines `not_applicable` that way).
   */
  private kycStatus(role: AdminUserRole, hasKycRow: boolean): AdminUserKycStatus {
    if (role !== "INVERSOR") return "not_applicable";
    return hasKycRow ? "approved_simulated" : "not_started";
  }

  private filter(users: readonly AdminUser[], query: AdminUsersQuery): readonly AdminUser[] {
    const search = query.search?.toLowerCase();
    const matched = users.filter((user) => {
      if (query.role !== undefined && user.role !== query.role) return false;
      if (query.status !== undefined && user.status !== query.status) return false;
      if (search === undefined) return true;
      return (
        user.displayName.toLowerCase().includes(search) || user.email.toLowerCase().includes(search)
      );
    });

    // Deterministic order so pagination is stable across requests.
    return [...matched].sort(
      (a, b) =>
        compare(a.displayName.toLowerCase(), b.displayName.toLowerCase()) || compare(a.userId, b.userId)
    );
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("malformed persistence row");
    }
    return value as Record<string, unknown>;
  }

  private text(value: unknown): string {
    if (typeof value !== "string" || value.length === 0) throw new Error("malformed text column");
    return value;
  }

  private optionalText(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined;
    return this.text(value);
  }

  /** A `not null` boolean column; a missing or non-boolean value fails the read. */
  private boolean(value: unknown): boolean {
    if (typeof value !== "boolean") throw new Error("malformed boolean column");
    return value;
  }

  private role(value: unknown): AdminUserRole {
    if (typeof value === "string" && ROLES.includes(value as AdminUserRole)) {
      return value as AdminUserRole;
    }
    throw new Error("malformed role");
  }

  private profileStatus(value: unknown): "active" | "inactive" {
    if (typeof value === "string" && PROFILE_STATUSES.includes(value as "active" | "inactive")) {
      return value as "active" | "inactive";
    }
    throw new Error("malformed profile status");
  }

  private logProvider(operation: string, error: unknown): void {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error(`[SupabaseAdminUsersReader] ${operation} failed`, { code });
  }
}

/** Only the fields this adapter reads; the SDK's `User` is a superset. */
interface AuthUserColumns {
  readonly id?: unknown;
  readonly email?: unknown;
  readonly last_sign_in_at?: unknown;
  readonly invited_at?: unknown;
  readonly email_confirmed_at?: unknown;
}

function compare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
