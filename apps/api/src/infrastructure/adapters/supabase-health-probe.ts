import type { SupabaseClient } from "@supabase/supabase-js";
import type { DependencyStatus } from "../http/routes/health.route.js";

/**
 * `audit_log` always exists and is readable with the `service_role` client
 * (Feature #370), so it is the cheapest table to probe. `head: true` issues a
 * HEAD so PostgREST returns headers only — the probe's cost is one round trip,
 * never a row.
 */
const PROBE_TABLE = "audit_log";

/**
 * The Supabase liveness probe for `GET /health` (#31/WU1).
 *
 * It is deliberately total: any PostgREST error or thrown failure collapses to
 * `"unavailable"`, and `message`/`details`/`hint` never cross this boundary —
 * the report says *that* the dependency is unreachable, never *why*.
 */
export class SupabaseHealthProbe {
  constructor(private readonly client: SupabaseClient) {}

  async check(): Promise<DependencyStatus> {
    try {
      const { error } = await this.client.from(PROBE_TABLE).select("actor_user_id", { head: true });
      return error ? "unavailable" : "ok";
    } catch {
      return "unavailable";
    }
  }
}
