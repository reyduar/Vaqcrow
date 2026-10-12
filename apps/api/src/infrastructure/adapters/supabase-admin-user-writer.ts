import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { AdminUserRole } from "@vaqcrow/domain";
import type {
  AdminUserProfile,
  AdminUserStatus,
  AdminUserWriterPort,
  AdminUserWriterResult
} from "../../application/ports/admin-user-writer-port.js";

/**
 * The Supabase admin-user writer (Feature #390, WU3a).
 *
 * The API connects as `service_role`, so every read/write here bypasses RLS and
 * is the single enforcement point for `public.profile` role/status changes.
 * `findProfile` reads one row; `countActiveAdmins` is an exact head count of
 * active ADMINs (the last-admin guard's input); `setActive`/`setRole` update one
 * row and report `not_found` when the update matches nothing (a concurrent
 * delete). A malformed row, a missing exact count, a provider error or a throw
 * is a sanitized `unavailable` — `message`/`details`/`hint` never cross this
 * boundary.
 */

const PROFILE_TABLE = "profile";
const PROFILE_COLUMNS = "user_id, role, status";
const KEY_COLUMN = "user_id";
const ACTIVE_ADMIN_ROLE = "ADMIN";
const ACTIVE_STATUS = "active";

const ROLES: readonly AdminUserRole[] = ["PYME", "INVERSOR", "ADMIN"];
const STATUSES: readonly AdminUserStatus[] = ["active", "inactive"];

const NOT_FOUND: AdminUserWriterResult<never> = { ok: false, error: { code: "not_found" } };
const UNAVAILABLE: AdminUserWriterResult<never> = { ok: false, error: { code: "unavailable" } };

export class SupabaseAdminUserWriter implements AdminUserWriterPort {
  constructor(private readonly client: SupabaseClient) {}

  async findProfile(userId: string): Promise<AdminUserWriterResult<AdminUserProfile>> {
    try {
      const { data, error } = await this.client
        .from(PROFILE_TABLE)
        .select(PROFILE_COLUMNS)
        .eq(KEY_COLUMN, userId)
        .maybeSingle();

      if (error) {
        this.logProvider("findProfile", error);
        return UNAVAILABLE;
      }
      if (data === null || data === undefined) return NOT_FOUND;

      return { ok: true, value: this.toProfile(data) };
    } catch (cause) {
      this.logUnexpected("findProfile", cause);
      return UNAVAILABLE;
    }
  }

  async countActiveAdmins(): Promise<AdminUserWriterResult<number>> {
    try {
      const { count, error } = await this.client
        .from(PROFILE_TABLE)
        .select(KEY_COLUMN, { count: "exact", head: true })
        .eq("role", ACTIVE_ADMIN_ROLE)
        .eq("status", ACTIVE_STATUS);

      if (error) {
        this.logProvider("countActiveAdmins", error);
        return UNAVAILABLE;
      }
      // Without an exact count the last-admin guard cannot be applied honestly.
      if (count === null || count === undefined) {
        this.logUnexpected("countActiveAdmins", new Error("count without an exact value"));
        return UNAVAILABLE;
      }

      return { ok: true, value: count };
    } catch (cause) {
      this.logUnexpected("countActiveAdmins", cause);
      return UNAVAILABLE;
    }
  }

  async setActive(userId: string, active: boolean): Promise<AdminUserWriterResult<void>> {
    return this.update(userId, { status: active ? "active" : "inactive" }, "setActive");
  }

  async setRole(userId: string, role: AdminUserRole): Promise<AdminUserWriterResult<void>> {
    return this.update(userId, { role }, "setRole");
  }

  /** The shared `UPDATE ... WHERE user_id = $1 RETURNING user_id` shape. */
  private async update(
    userId: string,
    values: Readonly<Record<string, string>>,
    operation: string
  ): Promise<AdminUserWriterResult<void>> {
    try {
      const { data, error } = await this.client
        .from(PROFILE_TABLE)
        .update(values)
        .eq(KEY_COLUMN, userId)
        .select(KEY_COLUMN);

      if (error) {
        this.logProvider(operation, error);
        return UNAVAILABLE;
      }
      if (!Array.isArray(data)) {
        this.logUnexpected(operation, new Error("update without a returned row set"));
        return UNAVAILABLE;
      }

      // No matched row: the profile was deleted between the read and the write.
      return data.length > 0 ? { ok: true, value: undefined } : NOT_FOUND;
    } catch (cause) {
      this.logUnexpected(operation, cause);
      return UNAVAILABLE;
    }
  }

  private toProfile(row: unknown): AdminUserProfile {
    const value = this.asRecord(row);
    const userId = this.text(value[KEY_COLUMN]);
    const role = value["role"];
    const status = value["status"];

    if (typeof role !== "string" || !ROLES.includes(role as AdminUserRole)) {
      throw new Error("malformed role");
    }
    if (typeof status !== "string" || !STATUSES.includes(status as AdminUserStatus)) {
      throw new Error("malformed profile status");
    }

    return { userId, role: role as AdminUserRole, status: status as AdminUserStatus };
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

  private logProvider(operation: string, error: PostgrestError): void {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error(`[SupabaseAdminUserWriter] ${operation} error`, { code: error.code });
  }

  private logUnexpected(operation: string, cause: unknown): void {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error(`[SupabaseAdminUserWriter] ${operation} failed`, {
      cause: cause instanceof Error ? cause.name : "unknown"
    });
  }
}
