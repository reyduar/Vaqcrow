import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditEntry, AuditLogPort, AuditLogResult } from "../../application/ports/audit-log-port.js";

const TABLE = "audit_log";

/** Append-only writer: `service_role` holds INSERT/SELECT on `audit_log`, nothing else. */
export class SupabaseAuditLog implements AuditLogPort {
  constructor(private readonly client: SupabaseClient) {}

  async append(entry: AuditEntry): Promise<AuditLogResult> {
    try {
      const { error } = await this.client.from(TABLE).insert({
        actor_user_id: entry.actorUserId,
        action: entry.action,
        target_type: entry.targetType,
        target_id: entry.targetId,
        ...(entry.detail === undefined ? {} : { detail: entry.detail }),
        ...(entry.correlationId === undefined ? {} : { correlation_id: entry.correlationId })
      });

      if (error) {
        // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
        console.error("[SupabaseAuditLog] append failed", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          correlationId: entry.correlationId
        });
        return { ok: false, error: { code: "unavailable" } };
      }

      return { ok: true, value: undefined };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }
}
