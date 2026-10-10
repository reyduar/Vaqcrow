export interface AuditEntry {
  readonly actorUserId: string;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly detail?: Readonly<Record<string, unknown>>;
  readonly correlationId?: string;
}

export type AuditLogResult =
  | { readonly ok: true; readonly value: void }
  | { readonly ok: false; readonly error: { readonly code: "unavailable" } };

export interface AuditLogPort {
  /** Append-only: there is no update or delete. `unavailable` is the only failure. */
  append(entry: AuditEntry): Promise<AuditLogResult>;
}
