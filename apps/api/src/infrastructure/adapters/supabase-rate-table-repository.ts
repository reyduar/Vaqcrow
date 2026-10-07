import type { SupabaseClient } from "@supabase/supabase-js";
import type { RateSnapshot, RateTableRepositoryPort, RateTableResult, RateSource } from "../../application/ports/rate-table-repository-port.js";

const TABLE = "fx_rate";

export class SupabaseRateTableRepository implements RateTableRepositoryPort {
  constructor(private readonly client: SupabaseClient) {}

  async create(rate: RateSnapshot): Promise<RateTableResult<RateSnapshot>> {
    try {
      const { data, error } = await this.client.from(TABLE).insert(this.toRow(rate)).select().single();
      if (error) return { ok: false, error: error.code === "23505" ? { code: "already_exists" } : this.error() };
      return { ok: true, value: this.toRecord(data) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async findCurrent(now: string): Promise<RateTableResult<RateSnapshot>> {
    try {
      const { data, error } = await this.client.from(TABLE).select().lte("effective_at", now).order("effective_at", { ascending: false }).order("version", { ascending: false }).limit(1).maybeSingle();
      if (error) return { ok: false, error: this.error() };
      if (!data) return { ok: false, error: { code: "not_found" } };
      return { ok: true, value: this.toRecord(data) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  private toRow(rate: RateSnapshot): Record<string, unknown> {
    return { version: rate.version, effective_at: rate.effectiveAt, author_user_id: rate.authorUserId, source: rate.source, usd_to_ars: rate.usdToArs.toString(), stroops_per_usd: rate.stroopsPerUsd.toString() };
  }

  private toRecord(row: unknown): RateSnapshot {
    if (typeof row !== "object" || row === null || Array.isArray(row)) throw new Error("Malformed rate row");
    const value = row as Record<string, unknown>;
    const source = value.source;
    if (typeof value.version !== "number" || !Number.isSafeInteger(value.version) || typeof value.effective_at !== "string" || typeof value.author_user_id !== "string" || (source !== "manual" && source !== "provider")) throw new Error("Malformed rate row");
    return { version: value.version, effectiveAt: value.effective_at, authorUserId: value.author_user_id, source: source as RateSource, usdToArs: this.bigint(value.usd_to_ars), stroopsPerUsd: this.bigint(value.stroops_per_usd) };
  }

  private bigint(value: unknown): bigint {
    if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
    throw new Error("Malformed integer rate");
  }

  /** PostgREST failures collapse to one sanitized code; no provider text crosses this boundary. */
  private error(): { readonly code: "unavailable" } {
    return { code: "unavailable" };
  }
}
