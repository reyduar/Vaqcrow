/**
 * Frozen synthetic contradictory case (Task #56): the declared request total
 * does not match the sum of the reported sales periods. Kept separate from
 * `panaderiaHorizonte` so that fixture and its tests stay untouched. Pure
 * data, no I/O, no randomness, no real PII.
 */
import type { SmeRequest } from "@vaqcrow/contracts";
import { SIMULADO_LABEL, type SalesPeriod } from "./panaderia-horizonte";

const PROVENANCE = "Declaración mensual sintética";

// Reported periods add up to 9_700_000 ARS, but the request declares 12_000_000.
export const contradictoryRequest: SmeRequest = Object.freeze({
  smeReference: "sme:SYN-CONTRA-0001",
  declaredTotalArs: 12_000_000,
  periodStart: "2026-01",
  periodEnd: "2026-03",
  simuladoLabel: SIMULADO_LABEL
});

export const contradictorySalesPeriods: readonly SalesPeriod[] = Object.freeze([
  Object.freeze({
    period: "2026-01",
    label: "Enero 2026",
    amountArs: 3_200_000,
    status: "reported",
    provenance: PROVENANCE,
    evidenceRef: "sales:contra:2026-01",
    simuladoLabel: SIMULADO_LABEL
  }),
  Object.freeze({
    period: "2026-02",
    label: "Febrero 2026",
    amountArs: 3_250_000,
    status: "reported",
    provenance: PROVENANCE,
    evidenceRef: "sales:contra:2026-02",
    simuladoLabel: SIMULADO_LABEL
  }),
  Object.freeze({
    period: "2026-03",
    label: "Marzo 2026",
    amountArs: 3_250_000,
    status: "reported",
    provenance: PROVENANCE,
    evidenceRef: "sales:contra:2026-03",
    simuladoLabel: SIMULADO_LABEL
  })
]);
