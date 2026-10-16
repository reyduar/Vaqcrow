/**
 * The current FX rate capability (#572). Vendor-free and React-free: the HTTP
 * adapter lives in `infrastructure/rates/`. It mirrors `GET /rates/current`,
 * which exposes only the rate itself, never the admin metadata.
 *
 * The rate is the simulated USD→ARS table the admin maintains (`fx_rate`), not
 * a market quote: the ARS↔asset conversion is simulated in this demo, and the
 * UI labels every converted value as such.
 */

/** `usdToArs` is scaled by 10^6 (`RATE_SCALE`); both stay `bigint`. */
export interface XlmArsRate {
  readonly usdToArs: bigint;
  readonly stroopsPerUsd: bigint;
}

/** `not_found` means no rate is in effect; `unauthenticated` covers 401/403. */
export type RateErrorCode = "not_found" | "unauthenticated" | "unavailable" | "network";

export type RateResult =
  | { readonly ok: true; readonly rate: XlmArsRate }
  | { readonly ok: false; readonly code: RateErrorCode };

export interface RatePort {
  getCurrent(): Promise<RateResult>;
}
