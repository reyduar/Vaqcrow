import type { SalesPeriodContract } from "@vaqcrow/contracts";
import { SALES_PROVENANCE } from "./simulated-sales-dataset.js";

/**
 * Deterministic synthetic sales series for any well-formed SME reference
 * (U11, owner decision 2026-10-08, option a). A wizard application carries the
 * CUIT digits as `smeReference`, which the frozen dataset does not know, so the
 * simulated feed derives a series from a stable hash of the reference instead
 * of answering `not_found`.
 *
 * Pure: no I/O, no `Math.random`, no clock. The same reference always yields
 * the same series, in every process; different references yield different
 * series. The period window is the frozen dataset's (2026-01..2026-08 plus the
 * 2026-09 feed period), so the calendar is never read. Every datum carries
 * `simuladoLabel: "SIMULADO"` and the Spanish synthetic provenance, exactly as
 * the frozen dataset does — nothing here passes for real fiscal or ERP data.
 *
 * The series is deliberately plain: every month `reported`, month-over-month
 * drift within ±5%, so it never implies a missing month or an anomaly. The
 * frozen `sme:SYN-PH-0001` dataset keeps those authored cases.
 */

/** A reference the synthetic feed accepts: 1..128 printable identifier characters, no whitespace. */
const WELL_FORMED_REFERENCE = /^[A-Za-z0-9:._-]{1,128}$/;

const HISTORICAL_PERIODS = [
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
  "2026-07",
  "2026-08"
] as const;

const NEXT_PERIOD = "2026-09";

/** Opening monthly sales between ARS 1.5M and 9M. */
const MIN_OPENING_ARS = 1_500_000;
const OPENING_SPAN_ARS = 7_500_000;

/** Month-over-month factor in [0.95, 1.05). */
const MIN_DRIFT = 0.95;
const DRIFT_SPAN = 0.1;

export function isWellFormedSalesReference(reference: string): boolean {
  return WELL_FORMED_REFERENCE.test(reference);
}

/** FNV-1a (32-bit) over the reference's UTF-16 code units: stable across processes and platforms. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** mulberry32: a tiny seeded generator; same seed, same sequence, values in [0, 1). */
function seededSequence(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function toPeriod(period: string, amountArs: number): SalesPeriodContract {
  return Object.freeze({
    period,
    amountArs,
    status: "reported" as const,
    provenance: SALES_PROVENANCE,
    evidenceRef: `sales:${period}`,
    simuladoLabel: "SIMULADO" as const
  });
}

/** Amounts are whole hundreds of ARS, like an authored declaration. */
function roundToHundreds(amount: number): number {
  return Math.round(amount / 100) * 100;
}

export interface SyntheticSalesSeries {
  readonly historical: readonly SalesPeriodContract[];
  readonly next: SalesPeriodContract;
}

/** The synthetic series for a well-formed reference; callers check `isWellFormedSalesReference` first. */
export function synthesizeSalesSeries(reference: string): SyntheticSalesSeries {
  const next = seededSequence(fnv1a(reference));
  let amount = MIN_OPENING_ARS + next() * OPENING_SPAN_ARS;

  const historical = HISTORICAL_PERIODS.map((period, index) => {
    if (index > 0) {
      amount *= MIN_DRIFT + next() * DRIFT_SPAN;
    }
    return toPeriod(period, roundToHundreds(amount));
  });

  amount *= MIN_DRIFT + next() * DRIFT_SPAN;

  return Object.freeze({
    historical: Object.freeze(historical),
    next: toPeriod(NEXT_PERIOD, roundToHundreds(amount))
  });
}
