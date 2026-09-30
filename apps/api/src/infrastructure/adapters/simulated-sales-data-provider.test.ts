import { describe, expect, it } from "vitest";
import type { SalesDataProviderResult } from "../../application/ports/sales-data-provider-port.js";
import {
  DEMO_BUSINESS_ID,
  HISTORICAL_SALES_PERIODS,
  NEXT_SALES_PERIOD,
  SME_REFERENCE_TO_BUSINESS_ID
} from "./simulated-sales-dataset.js";
import { createSimulatedSalesDataProvider } from "./simulated-sales-data-provider.js";

/**
 * The simulated sales feed (Task #83): frozen data, no I/O, no clock, no
 * randomness. These tests pin the dataset against drift from the canonical
 * web fixture and pin the record-next replay semantics against the same
 * idempotency contract the review repository established (`applied: false`
 * on replay).
 */

function unwrap<T>(result: SalesDataProviderResult<T>): T {
  if (!result.ok) {
    throw new Error(`expected an ok result, got error code "${result.error.code}"`);
  }
  return result.value;
}

describe("simulated sales dataset (frozen constants)", () => {
  it("holds exactly the eight historical periods 2026-01..2026-08 in order", () => {
    expect(HISTORICAL_SALES_PERIODS.map((period) => period.period)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08"
    ]);
  });

  it("marks April 2026 missing with a null amount — never 0", () => {
    const april = HISTORICAL_SALES_PERIODS.find((period) => period.period === "2026-04");
    expect(april?.amountArs).toBeNull();
    expect(april?.status).toBe("missing");
    expect(april?.evidenceRef).toBe("missing:2026-04");
  });

  it("marks June 2026 anomalous and asserts no cause anywhere in the datum", () => {
    const june = HISTORICAL_SALES_PERIODS.find((period) => period.period === "2026-06");
    expect(june?.amountArs).toBe(6_240_000);
    expect(june?.status).toBe("anomalous");
    expect(june?.evidenceRef).toBe("sales:2026-06");
    // Exactly the shared-contract keys: no note, no cause, no extra field.
    expect(Object.keys(june ?? {}).sort()).toEqual([
      "amountArs",
      "evidenceRef",
      "period",
      "provenance",
      "simuladoLabel",
      "status"
    ]);
  });

  it("carries the SIMULADO label and the Spanish provenance on every historical period", () => {
    for (const period of HISTORICAL_SALES_PERIODS) {
      expect(period.simuladoLabel).toBe("SIMULADO");
      expect(period.provenance).toBe("Declaración mensual sintética");
    }
  });

  it("defines the next period 2026-09 as a reported frozen integer amount", () => {
    expect(NEXT_SALES_PERIOD.period).toBe("2026-09");
    expect(NEXT_SALES_PERIOD.status).toBe("reported");
    expect(NEXT_SALES_PERIOD.evidenceRef).toBe("sales:2026-09");
    expect(NEXT_SALES_PERIOD.simuladoLabel).toBe("SIMULADO");
    expect(NEXT_SALES_PERIOD.provenance).toBe("Declaración mensual sintética");
    expect(Number.isInteger(NEXT_SALES_PERIOD.amountArs)).toBe(true);
    expect(NEXT_SALES_PERIOD.amountArs).toBeGreaterThan(0);
  });
});

describe("createSimulatedSalesDataProvider", () => {
  it("serves the eight historical periods before anything is recorded", async () => {
    const provider = createSimulatedSalesDataProvider();

    const periods = unwrap(await provider.getPeriods(DEMO_BUSINESS_ID));

    expect(periods).toHaveLength(8);
    expect(periods[periods.length - 1]?.period).toBe("2026-08");
  });

  it("answers not_found for an unknown business on both methods", async () => {
    const provider = createSimulatedSalesDataProvider();

    const periods = await provider.getPeriods("negocio-inexistente");
    const recorded = await provider.recordNextPeriod("negocio-inexistente");

    expect(periods).toEqual({ ok: false, error: { code: "not_found" } });
    expect(recorded).toEqual({ ok: false, error: { code: "not_found" } });
  });

  it("records the next period exactly once and replays idempotently", async () => {
    const provider = createSimulatedSalesDataProvider();

    const first = unwrap(await provider.recordNextPeriod(DEMO_BUSINESS_ID));
    const replay = unwrap(await provider.recordNextPeriod(DEMO_BUSINESS_ID));

    expect(first.applied).toBe(true);
    expect(first.period.period).toBe("2026-09");
    expect(replay.applied).toBe(false);
    expect(replay.period).toEqual(first.period);
  });

  it("includes the recorded period in the series afterwards", async () => {
    const provider = createSimulatedSalesDataProvider();
    unwrap(await provider.recordNextPeriod(DEMO_BUSINESS_ID));

    const periods = unwrap(await provider.getPeriods(DEMO_BUSINESS_ID));

    expect(periods).toHaveLength(9);
    const last = periods[periods.length - 1];
    expect(last?.period).toBe("2026-09");
    expect(last?.simuladoLabel).toBe("SIMULADO");
    expect(last?.provenance).toBe("Declaración mensual sintética");
  });

  it("keeps the recording state per provider instance (in-memory, restart resets)", async () => {
    const recorder = createSimulatedSalesDataProvider();
    unwrap(await recorder.recordNextPeriod(DEMO_BUSINESS_ID));

    const fresh = createSimulatedSalesDataProvider();
    const periods = unwrap(await fresh.getPeriods(DEMO_BUSINESS_ID));

    expect(periods).toHaveLength(8);
  });

  it("fails closed with unavailable on both methods when configured to fail", async () => {
    const provider = createSimulatedSalesDataProvider({ failWith: "unavailable" });

    const periods = await provider.getPeriods(DEMO_BUSINESS_ID);
    const recorded = await provider.recordNextPeriod(DEMO_BUSINESS_ID);

    expect(periods).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(recorded).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});

describe("synthetic SME reference mapping (one place, inside the simulated feed)", () => {
  const SME_REFERENCE = "sme:SYN-PH-0001";

  it("maps the synthetic SME reference to the demo business", () => {
    expect(SME_REFERENCE_TO_BUSINESS_ID[SME_REFERENCE]).toBe(DEMO_BUSINESS_ID);
  });

  it("serves the same series for the SME reference as for the business id", async () => {
    const provider = createSimulatedSalesDataProvider();

    const byReference = unwrap(await provider.getPeriods(SME_REFERENCE));
    const byBusiness = unwrap(await provider.getPeriods(DEMO_BUSINESS_ID));

    expect(byReference).toEqual(byBusiness);
    expect(byReference).toHaveLength(8);
  });

  it("shares the recorded feed period between the reference and the business id", async () => {
    const provider = createSimulatedSalesDataProvider();
    unwrap(await provider.recordNextPeriod(SME_REFERENCE));

    expect(unwrap(await provider.getPeriods(DEMO_BUSINESS_ID))).toHaveLength(9);
    expect(unwrap(await provider.getPeriods(SME_REFERENCE))).toHaveLength(9);
  });

  it("keeps an unknown reference not_found on both methods", async () => {
    const provider = createSimulatedSalesDataProvider();

    expect(await provider.getPeriods("sme:UNKNOWN")).toEqual({ ok: false, error: { code: "not_found" } });
    expect(await provider.recordNextPeriod("sme:UNKNOWN")).toEqual({ ok: false, error: { code: "not_found" } });
  });

  it("does not resolve inherited object keys as references", async () => {
    const provider = createSimulatedSalesDataProvider();

    expect(await provider.getPeriods("constructor")).toEqual({ ok: false, error: { code: "not_found" } });
    expect(await provider.getPeriods("__proto__")).toEqual({ ok: false, error: { code: "not_found" } });
  });
});
