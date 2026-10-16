import type { XlmArsRate } from "../ports/rate-port";

/**
 * The simulated ARS equivalent of an XLM amount (#572). Money never becomes a
 * `number`: the dot-decimal XLM string is read into stroops and converted with
 * integer division, `stroops × usdToArs / (stroopsPerUsd × RATE_SCALE)`, as the
 * API's portfolio does (`get-investor-portfolio.ts`). The result is truncated to
 * whole ARS and always shown as approximate and simulated.
 *
 * An unknown balance, a missing rate or one that cannot convert is `null`: the
 * caller hides the label rather than inventing a value.
 */

/** ARS per USD scale, matching the API's `RATE_SCALE`. */
const RATE_SCALE = 1_000_000n;
const STROOP_DIGITS = 7;
/** A plain non-negative decimal with at most 7 fraction digits (stroop precision). */
const XLM_PATTERN = /^(\d+)(?:\.(\d{1,7}))?$/;

const ARS_FORMATTER = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

function toStroops(xlm: string): bigint | null {
  const match = XLM_PATTERN.exec(xlm);
  if (!match) return null;
  const whole = match[1] ?? "0";
  const fraction = (match[2] ?? "").padEnd(STROOP_DIGITS, "0");
  return BigInt(whole) * 10_000_000n + BigInt(fraction);
}

/** XLM balance (`"4120.5"`) -> whole ARS at the given rate, or `null` when unknown. */
export function xlmToArs(balanceXlm: string | null, rate: XlmArsRate | null): bigint | null {
  if (balanceXlm === null || rate === null || rate.stroopsPerUsd <= 0n || rate.usdToArs < 0n) return null;
  const stroops = toStroops(balanceXlm);
  if (stroops === null) return null;
  return (stroops * rate.usdToArs) / (rate.stroopsPerUsd * RATE_SCALE);
}

/** `4666724n` -> `"≈ ARS 4.666.724"`. */
export function formatApproxArs(ars: bigint): string {
  return `≈ ARS ${ARS_FORMATTER.format(ars)}`;
}
