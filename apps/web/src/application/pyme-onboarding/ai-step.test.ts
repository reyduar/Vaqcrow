import { describe, expect, it } from "vitest";
import {
  AI_RISK_LABELS,
  AI_SIMULATED_CHECKS,
  AI_STEP_COPY,
  riskBandLabel
} from "./ai-step";

describe("AI_STEP_COPY", () => {
  it("carries the template's step-3 copy verbatim", () => {
    expect(AI_STEP_COPY.heading).toBe("Evaluación AI");
    expect(AI_STEP_COPY.subtitle).toBe(
      "La IA ordena la evidencia que cargaste, marca faltantes y anomalías y propone una banda de riesgo. No aprueba ni rechaza: la decisión la toma una persona en el paso siguiente."
    );
    expect(AI_STEP_COPY.simulado).toBe("SIMULADO");
    expect(AI_STEP_COPY.busyTitle).toBe("Analizando tu solicitud…");
    expect(AI_STEP_COPY.busyBody).toBe("Revisando KYC, ventas declaradas y archivos adjuntos.");
    expect(AI_STEP_COPY.riskLabel).toBe("Banda de riesgo propuesta");
    expect(AI_STEP_COPY.riskSubject).toBe("Sujeta a revisión humana");
    expect(AI_STEP_COPY.continueLabel).toBe("Continuar");
    expect(AI_STEP_COPY.correctLabel).toBe("Corregir datos");
  });
});

describe("riskBandLabel", () => {
  it("names every band in text, so colour is never the only signal", () => {
    expect(AI_RISK_LABELS).toEqual({ low: "Riesgo bajo", medium: "Riesgo medio", high: "Riesgo alto" });
    expect(riskBandLabel("low")).toBe("Riesgo bajo");
    expect(riskBandLabel("medium")).toBe("Riesgo medio");
    expect(riskBandLabel("high")).toBe("Riesgo alto");
  });
});

describe("AI_SIMULATED_CHECKS", () => {
  it("lists the template's four checks with their kind", () => {
    expect(AI_SIMULATED_CHECKS.map((check) => [check.kind, check.title])).toEqual([
      ["ok", "Identidad y empresa"],
      ["ok", "Ventas declaradas"],
      ["warning", "Faltante"],
      ["warning", "Anomalía"]
    ]);
    expect(AI_SIMULATED_CHECKS.map((check) => check.body)).toEqual([
      "KYC simulado aprobado. CUIT y razón social coinciden.",
      "12 meses cargados. Coinciden con el archivo adjunto.",
      "No hay comprobante de domicilio comercial. Podés sumarlo después.",
      "Marzo muestra ventas 38% más altas que el promedio. La persona revisora va a pedir contexto."
    ]);
  });
});
