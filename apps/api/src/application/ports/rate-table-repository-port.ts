export type RateSource = "manual" | "provider";

export interface RateSnapshot {
  readonly version: number;
  readonly effectiveAt: string;
  readonly authorUserId: string;
  readonly source: RateSource;
  /** ARS per USD, scaled by RATE_SCALE. */
  readonly usdToArs: bigint;
  /** Native stroops per USD. */
  readonly stroopsPerUsd: bigint;
}

export type RateTableError = { readonly code: "already_exists" | "not_found" | "unavailable" };
export type RateTableResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: RateTableError };

export interface RateTableRepositoryPort {
  create(rate: RateSnapshot): Promise<RateTableResult<RateSnapshot>>;
  findCurrent(now: string): Promise<RateTableResult<RateSnapshot>>;
}
