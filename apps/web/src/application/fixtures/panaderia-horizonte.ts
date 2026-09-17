/**
 * Frozen synthetic SME fixture for the demo (Feature #17 / Task #53):
 * Panadería Horizonte SRL. Pure data — no I/O, no `Math.random`, no
 * `Date.now`, no `new Date()`. Every literal below is authored once and
 * frozen permanently; nothing here is generated or randomized.
 *
 * Contains no seeds, private keys, or real PII — every field describes a
 * fictional bakery and a synthetic KYC/sales history.
 */

/**
 * `SIMULADO` travels with the datum (per `docs/design/demo-ui.md` §9.3:
 * "La etiqueta SIMULADO viaja con el dato al resumirlo, graficarlo o
 * citarlo; no vive solo en la pantalla de origen"). Every record below
 * carries this label itself so a consumer that summarizes, charts, or
 * quotes the datum elsewhere never has to reattach it independently.
 */
export const SIMULADO_LABEL = "SIMULADO" as const;

export type SalesPeriodStatus = "reported" | "missing" | "anomalous";

export interface SalesPeriod {
  readonly period: string; // "2026-01" … "2026-08"
  readonly label: string; // "Enero 2026"
  readonly amountArs: number | null; // null ONLY when status === "missing" — never 0
  readonly status: SalesPeriodStatus;
  readonly provenance: string;
  readonly evidenceRef: string;
  readonly simuladoLabel: typeof SIMULADO_LABEL;
  readonly note?: string;
}

export interface SyntheticSme {
  readonly legalName: string;
  readonly sector: string;
  readonly location: string;
  readonly foundedYear: number;
  readonly fundingGoalArs: number;
  readonly simuladoLabel: typeof SIMULADO_LABEL;
  readonly kyc: {
    readonly status: string;
    readonly provider: string;
    readonly checkedAt: string; // frozen ISO literal
    readonly reference: string;
    readonly simuladoLabel: typeof SIMULADO_LABEL;
  };
  readonly sales: readonly SalesPeriod[]; // exactly 8, Jan–Aug 2026
}

const SALES_PROVENANCE = "Declaración mensual sintética";

// June 2026 is deliberately ~1.8x the surrounding trend (a visible anomaly)
// with no cause asserted anywhere in its label or note, per the spec's
// "June anomaly, no cause" scenario.
export const panaderiaHorizonte: SyntheticSme = Object.freeze({
  legalName: "Panadería Horizonte SRL",
  sector: "Panadería y productos de panificación",
  location: "Córdoba, Argentina",
  foundedYear: 2016,
  fundingGoalArs: 15_000_000,
  simuladoLabel: SIMULADO_LABEL,
  kyc: Object.freeze({
    status: "Aprobado · SIMULADO",
    provider: "Adaptador KYC simulado v1",
    checkedAt: "2026-01-15T09:30:00-03:00",
    reference: "kyc:PH-2026-0001",
    simuladoLabel: SIMULADO_LABEL
  }),
  sales: Object.freeze([
    Object.freeze({
      period: "2026-01",
      label: "Enero 2026",
      amountArs: 3_150_000,
      status: "reported",
      provenance: SALES_PROVENANCE,
      evidenceRef: "sales:2026-01",
      simuladoLabel: SIMULADO_LABEL
    }),
    Object.freeze({
      period: "2026-02",
      label: "Febrero 2026",
      amountArs: 3_320_500,
      status: "reported",
      provenance: SALES_PROVENANCE,
      evidenceRef: "sales:2026-02",
      simuladoLabel: SIMULADO_LABEL
    }),
    Object.freeze({
      period: "2026-03",
      label: "Marzo 2026",
      amountArs: 3_410_750,
      status: "reported",
      provenance: SALES_PROVENANCE,
      evidenceRef: "sales:2026-03",
      simuladoLabel: SIMULADO_LABEL
    }),
    Object.freeze({
      period: "2026-04",
      label: "Abril 2026",
      amountArs: null,
      status: "missing",
      provenance: SALES_PROVENANCE,
      evidenceRef: "missing:2026-04",
      simuladoLabel: SIMULADO_LABEL,
      note: "Falta la declaración de abril de 2026"
    }),
    Object.freeze({
      period: "2026-05",
      label: "Mayo 2026",
      amountArs: 3_580_900,
      status: "reported",
      provenance: SALES_PROVENANCE,
      evidenceRef: "sales:2026-05",
      simuladoLabel: SIMULADO_LABEL
    }),
    Object.freeze({
      period: "2026-06",
      label: "Junio 2026",
      amountArs: 6_240_000,
      status: "anomalous",
      provenance: SALES_PROVENANCE,
      evidenceRef: "sales:2026-06",
      simuladoLabel: SIMULADO_LABEL,
      note: "Junio requiere revisión; no se determinó la causa"
    }),
    Object.freeze({
      period: "2026-07",
      label: "Julio 2026",
      amountArs: 3_690_300,
      status: "reported",
      provenance: SALES_PROVENANCE,
      evidenceRef: "sales:2026-07",
      simuladoLabel: SIMULADO_LABEL
    }),
    Object.freeze({
      period: "2026-08",
      label: "Agosto 2026",
      amountArs: 3_745_800,
      status: "reported",
      provenance: SALES_PROVENANCE,
      evidenceRef: "sales:2026-08",
      simuladoLabel: SIMULADO_LABEL
    })
  ])
});

export function missingSalesPeriods(): readonly SalesPeriod[] {
  return panaderiaHorizonte.sales.filter((period) => period.status === "missing");
}

export function anomalousSalesPeriods(): readonly SalesPeriod[] {
  return panaderiaHorizonte.sales.filter((period) => period.status === "anomalous");
}

/** Sum of every period with a reported figure; excludes the missing month only. */
export function reportedSalesTotalArs(): number {
  return panaderiaHorizonte.sales.reduce(
    (total, period) => total + (period.amountArs ?? 0),
    0
  );
}
