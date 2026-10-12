import type { AdminUsersPage, AdminUsersQuery } from "@vaqcrow/contracts";

/**
 * The ADMIN users list (Feature #390, WU2), read-only.
 *
 * The result is the already-parsed wire shape of `@vaqcrow/contracts`
 * (`AdminUsersPage`), so the route only has to serialize it. `viewerUserId` is
 * the verified principal's id and is used for exactly one thing — marking the
 * caller's own row (`isSelf`) — never to scope the listing: an admin reads every
 * account. `unavailable` is the only failure.
 */
export type AdminUsersReadResult =
  | { readonly ok: true; readonly value: AdminUsersPage }
  | { readonly ok: false; readonly error: { readonly code: "unavailable" } };

export interface AdminUsersReaderPort {
  list(query: AdminUsersQuery, viewerUserId: string): Promise<AdminUsersReadResult>;
}
