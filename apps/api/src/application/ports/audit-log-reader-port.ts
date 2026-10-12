import type { AuditLogPage, AuditLogQuery } from "@vaqcrow/contracts";

/**
 * The ADMIN audit-log read (Feature #390, WU2), read-only.
 *
 * The result is the already-parsed wire shape of `@vaqcrow/contracts`
 * (`AuditLogPage`), ordered newest first. The log is append-only and never
 * mutated here. `unavailable` is the only failure.
 */
export type AuditLogReadResult =
  | { readonly ok: true; readonly value: AuditLogPage }
  | { readonly ok: false; readonly error: { readonly code: "unavailable" } };

export interface AuditLogReaderPort {
  list(query: AuditLogQuery): Promise<AuditLogReadResult>;
}
