import type { SupabaseClient } from "@supabase/supabase-js";
import { parseAuditEntryView } from "@vaqcrow/contracts";
import type { AuditEntryView, AuditLogPage, AuditLogQuery } from "@vaqcrow/contracts";
import type {
  AuditLogReadResult,
  AuditLogReaderPort
} from "../../application/ports/audit-log-reader-port.js";

/**
 * The ADMIN audit-log read adapter (Feature #390, WU2).
 *
 * Reads `public.audit_log` newest first with server-side `range` pagination and
 * an exact `count`, then resolves each entry's `actorDisplayName` from
 * `public.profile` in one batched `in` read. `summary` is derived factually from
 * the recorded `action`/`target_type` — never an invented description; the raw
 * fields are also carried by the entry, so a caller can render whatever it needs.
 *
 * `search` filters the summary's source columns (`action`, `target_type`,
 * `target_id`) with a PostgREST `or`/`ilike`, since there is no stored summary
 * column to match and no migration is in scope. The term is pre-sanitized
 * because PostgREST has no bound parameters: its filter metacharacters cannot be
 * allowed to alter the filter tree. A provider error, a missing exact count, a
 * row whose actor has no profile, or any malformed column is a sanitized
 * `unavailable`; provider message/details/hint never cross this boundary.
 */

const AUDIT_TABLE = "audit_log";
const PROFILE_TABLE = "profile";
const AUDIT_COLUMNS = "id, actor_user_id, action, target_type, target_id, created_at";
const PROFILE_COLUMNS = "user_id, display_name";
const SEARCH_COLUMNS: readonly string[] = ["action", "target_type", "target_id"];
/** PostgREST filter-tree metacharacters and the `ilike` wildcard. */
const POSTGREST_METACHARACTERS = /[,()*%\\"]+/g;

interface AuditRow {
  readonly id: string;
  readonly actorUserId: string;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly occurredAt: string;
}

export class SupabaseAuditLogReader implements AuditLogReaderPort {
  constructor(private readonly client: SupabaseClient) {}

  async list(query: AuditLogQuery): Promise<AuditLogReadResult> {
    try {
      const first = (query.page - 1) * query.pageSize;
      const last = first + query.pageSize - 1;

      const base = this.client
        .from(AUDIT_TABLE)
        .select(AUDIT_COLUMNS, { count: "exact" })
        .order("created_at", { ascending: false });

      const search = this.sanitizeSearch(query.search);
      const searched = search === undefined ? base : base.or(this.searchFilter(search));

      const { data, error, count } = await searched.range(first, last);
      if (error) {
        this.logProvider("audit_log read", error);
        return { ok: false, error: { code: "unavailable" } };
      }
      // Without an exact count the caller cannot paginate honestly.
      if (count === null || count === undefined) throw new Error("audit_log read without an exact count");
      if (!Array.isArray(data)) throw new Error("malformed audit_log read");

      const rows = data.map((row) => this.toRow(row));
      const names = await this.readActorNames(rows.map((row) => row.actorUserId));

      const items: AuditEntryView[] = rows.map((row) => {
        const actorDisplayName = names.get(row.actorUserId);
        if (actorDisplayName === undefined) throw new Error("audit actor without a profile");
        return parseAuditEntryView({
          id: row.id,
          occurredAt: row.occurredAt,
          actorUserId: row.actorUserId,
          actorDisplayName,
          action: row.action,
          targetType: row.targetType,
          targetId: row.targetId,
          summary: `${row.action} · ${row.targetType}`
        });
      });

      const value: AuditLogPage = {
        items,
        total: count,
        page: query.page,
        pageSize: query.pageSize
      };
      return { ok: true, value };
    } catch (cause) {
      // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
      console.error("[SupabaseAuditLogReader] list failed", {
        cause: cause instanceof Error ? cause.name : "unknown"
      });
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  /** One batched read for every distinct actor on the page. */
  private async readActorNames(actorIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
    const unique = [...new Set(actorIds)];
    if (unique.length === 0) return new Map();

    const { data, error } = await this.client
      .from(PROFILE_TABLE)
      .select(PROFILE_COLUMNS)
      .in("user_id", unique);

    if (error) {
      this.logProvider("profile read", error);
      throw new Error("profile read failed");
    }
    if (!Array.isArray(data)) throw new Error("malformed profile read");

    const names = new Map<string, string>();
    for (const row of data) {
      const value = this.asRecord(row);
      names.set(this.text(value["user_id"]), this.text(value["display_name"]));
    }
    return names;
  }

  private searchFilter(search: string): string {
    return SEARCH_COLUMNS.map((column) => `${column}.ilike.*${search}*`).join(",");
  }

  /**
   * Strips the characters that would alter the PostgREST filter tree or inject
   * a wildcard; an all-metacharacter term collapses to "no search" rather than a
   * filter that matches everything.
   */
  private sanitizeSearch(search: string | undefined): string | undefined {
    if (search === undefined) return undefined;
    const normalized = search.replace(POSTGREST_METACHARACTERS, " ").replace(/\s+/g, " ").trim();
    return normalized.length === 0 ? undefined : normalized;
  }

  private toRow(row: unknown): AuditRow {
    const value = this.asRecord(row);
    return {
      id: this.text(value["id"]),
      actorUserId: this.text(value["actor_user_id"]),
      action: this.text(value["action"]),
      targetType: this.text(value["target_type"]),
      targetId: this.text(value["target_id"]),
      occurredAt: this.text(value["created_at"])
    };
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

  private logProvider(operation: string, error: unknown): void {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error(`[SupabaseAuditLogReader] ${operation} failed`, { code });
  }
}
