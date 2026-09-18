import { describe, expect, it } from "vitest";
import { contradictoryRequest, contradictorySalesPeriods } from "./contradictory-request";
import { SIMULADO_LABEL } from "./panaderia-horizonte";

describe("contradictory synthetic case", () => {
  it("declares a total that differs from the sum of reported periods", () => {
    const reported = contradictorySalesPeriods
      .filter((period) => period.status === "reported")
      .reduce((total, period) => total + (period.amountArs ?? 0), 0);
    expect(contradictoryRequest.declaredTotalArs).not.toBe(reported);
  });

  it("carries the SIMULADO label on the request and every period", () => {
    expect(contradictoryRequest.simuladoLabel).toBe(SIMULADO_LABEL);
    for (const period of contradictorySalesPeriods) {
      expect(period.simuladoLabel).toBe(SIMULADO_LABEL);
    }
  });
});
