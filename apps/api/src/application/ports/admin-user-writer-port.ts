import type { AdminUserRole } from "@vaqcrow/domain";

/**
 * The ADMIN user-management writer (Feature #390, WU3a).
 *
 * `public.profile` is the writable surface: `role` (`PYME`/`INVERSOR`/`ADMIN`)
 * and `status` (`active`/`inactive`). The API connects as `service_role`, so
 * this port is the single enforcement point and the Supabase adapter sanitizes
 * every provider failure to `unavailable`. A missing profile is `not_found`; a
 * write that matches no row (a concurrent delete) is `not_found` too.
 *
 * Plain data only: this port lives in `application/` and must not import
 * Fastify, Supabase, Stellar or LLM SDKs.
 */

export type AdminUserStatus = "active" | "inactive";

export interface AdminUserProfile {
  readonly userId: string;
  readonly role: AdminUserRole;
  readonly status: AdminUserStatus;
}

export type AdminUserWriterErrorCode = "not_found" | "unavailable";

export type AdminUserWriterResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: AdminUserWriterErrorCode } };

export interface AdminUserWriterPort {
  /** The target's current role and status; `not_found` when no profile exists. */
  findProfile(userId: string): Promise<AdminUserWriterResult<AdminUserProfile>>;

  /** How many profiles are active admins — the input to the last-admin guard. */
  countActiveAdmins(): Promise<AdminUserWriterResult<number>>;

  /** Sets `status` for the target; `not_found` when the row does not exist. */
  setActive(userId: string, active: boolean): Promise<AdminUserWriterResult<void>>;

  /** Sets `role` for the target; `not_found` when the row does not exist. */
  setRole(userId: string, role: AdminUserRole): Promise<AdminUserWriterResult<void>>;
}
