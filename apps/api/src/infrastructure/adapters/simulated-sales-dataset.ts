import type { SalesPeriodContract } from "@vaqcrow/contracts";

/**
 * Frozen synthetic sales dataset for the demo (issue #83): Panadería
 * Horizonte SRL. Pure data — no I/O, no `Math.random`, no `Date.now`, no
 * `new Date()`. Every literal below is authored once and frozen permanently.
 * Contains no seeds, private keys or real PII.
 *
 * CANONICAL SOURCE (decision D4): the historical values duplicate
 * `apps/web/src/application/fixtures/panaderia-horizonte.ts` EXACTLY
 * (amounts, statuses, evidence references, April missing with a null amount,
 * June anomalous with no cause asserted). `no-cross-app-imports` forbids
 * importing the web fixture from `apps/api`, so the dataset is duplicated
 * here and the drift risk is recorded — task #84 may add a cross-check.
 *
 * The fixture's screen-only fields (`label`, `note`) deliberately do not
 * cross into this dataset: `salesPeriodSchema` is a strict object, so the
 * periods carry exactly the contract's fields — including the optional
 * per-datum `provenance`, which the feed ALWAYS populates (decision D1).
 */

/** The single demo business. No identifier is established by any request schema, so the slug is frozen here. */
export const DEMO_BUSINESS_ID = "panaderia-horizonte";

/**
 * The synthetic SME references the sales feed can serve, mapped to the business
 * whose series it holds. An SME request carries `smeReference` (the web submits
 * `sme:SYN-PH-0001`), not a business id; both identifiers are synthetic and both
 * belong to this simulated feed, so the linkage lives here and nowhere else. A
 * real authorized source would resolve its own identifiers in its own adapter.
 */
export const SME_REFERENCE_TO_BUSINESS_ID: Readonly<Record<string, string>> = Object.freeze({
  "sme:SYN-PH-0001": DEMO_BUSINESS_ID
});

/** Verbatim from the web fixture's `SALES_PROVENANCE`. */
export const SALES_PROVENANCE = "Declaración mensual sintética";

const SIMULADO = "SIMULADO" as const;

/** The eight historical periods 2026-01..2026-08, mirroring the web fixture. */
export const HISTORICAL_SALES_PERIODS: readonly SalesPeriodContract[] = Object.freeze([
  Object.freeze({
    period: "2026-01",
    amountArs: 3_150_000,
    status: "reported" as const,
    provenance: SALES_PROVENANCE,
    evidenceRef: "sales:2026-01",
    simuladoLabel: SIMULADO
  }),
  Object.freeze({
    period: "2026-02",
    amountArs: 3_320_500,
    status: "reported" as const,
    provenance: SALES_PROVENANCE,
    evidenceRef: "sales:2026-02",
    simuladoLabel: SIMULADO
  }),
  Object.freeze({
    period: "2026-03",
    amountArs: 3_410_750,
    status: "reported" as const,
    provenance: SALES_PROVENANCE,
    evidenceRef: "sales:2026-03",
    simuladoLabel: SIMULADO
  }),
  // April is intentionally missing: null amount (never 0), per the fixture.
  Object.freeze({
    period: "2026-04",
    amountArs: null,
    status: "missing" as const,
    provenance: SALES_PROVENANCE,
    evidenceRef: "missing:2026-04",
    simuladoLabel: SIMULADO
  }),
  Object.freeze({
    period: "2026-05",
    amountArs: 3_580_900,
    status: "reported" as const,
    provenance: SALES_PROVENANCE,
    evidenceRef: "sales:2026-05",
    simuladoLabel: SIMULADO
  }),
  // June is deliberately ~1.8x the surrounding trend (a visible anomaly) and
  // no cause is asserted anywhere in the datum, per the fixture and
  // docs/design/demo-ui.md Pantalla 2.
  Object.freeze({
    period: "2026-06",
    amountArs: 6_240_000,
    status: "anomalous" as const,
    provenance: SALES_PROVENANCE,
    evidenceRef: "sales:2026-06",
    simuladoLabel: SIMULADO
  }),
  Object.freeze({
    period: "2026-07",
    amountArs: 3_690_300,
    status: "reported" as const,
    provenance: SALES_PROVENANCE,
    evidenceRef: "sales:2026-07",
    simuladoLabel: SIMULADO
  }),
  Object.freeze({
    period: "2026-08",
    amountArs: 3_745_800,
    status: "reported" as const,
    provenance: SALES_PROVENANCE,
    evidenceRef: "sales:2026-08",
    simuladoLabel: SIMULADO
  })
]);

/**
 * The next period the monthly feed records (decision D5): 2026-09, reported,
 * a frozen integer amount continuing the series trend (~3% over August), its
 * own evidence reference — and not anomalous; the June anomaly stays
 * historical.
 */
export const NEXT_SALES_PERIOD: SalesPeriodContract = Object.freeze({
  period: "2026-09",
  amountArs: 3_860_000,
  status: "reported",
  provenance: SALES_PROVENANCE,
  evidenceRef: "sales:2026-09",
  simuladoLabel: SIMULADO
});
