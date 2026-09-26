import { describe, expect, it } from "vitest";
import { disclosures, microcopy } from "./disclosures";

// Canonical texts quoted verbatim from docs/planning/DEMO.md §12 and
// docs/design/demo-ui.md §2 — byte-for-byte, including punctuation.
const CANONICAL_TEXTS: Record<string, string> = {
  simulation:
    "Demostración con datos simulados. La identidad, el KYC/KYB, las ventas y la conversión ARS/activo Stellar de este caso son sintéticos. No representan verificaciones ni movimientos de dinero real.",
  testnet:
    "Stellar Testnet. Las transacciones mostradas usan activos sin valor económico en Stellar Testnet. Un hash de Testnet demuestra ejecución técnica, no una inversión real ni disponibilidad en producción.",
  "non-custody":
    "Firma no custodial. Freighter es la wallet e interfaz de firma. La persona usuaria conserva sus claves; Vaqcrow construye y verifica la transacción y nunca recibe su seed.",
  "contract-custody":
    "Custodia por contrato. Durante la campaña, los aportes los custodia el contrato, no una persona: nadie tiene una clave para moverlos. El contrato sólo puede pagar al destino fijo definido al abrir la bóveda, y ese destino es inmutable. La meta la evalúa el contrato sobre el ledger y, al alcanzarla, liquida a la PyME en la misma transacción. No hay recuperación ni clawback: no existe forma de revertir un pago ya liquidado, y los fondos que nadie reclame sólo pueden salir por el barrido; si no, pueden quedarse en el contrato. El reembolso por vencimiento no se dispara solo: exige que alguien envíe la transacción, y es permissionless porque el destino ya está fijado.",
  "human-ai":
    "IA con supervisión humana. La IA organiza evidencia, identifica anomalías y propone una evaluación explicable. No inventa datos, no toma la decisión final, no calcula obligaciones financieras y no transfiere fondos.",
  "no-production":
    "No apto para producción. Esta demo no constituye una oferta de inversión, recomendación financiera, aprobación regulatoria ni prueba de legalidad, rentabilidad, solvencia, custodia, calidad de proveedores u operación en Argentina."
};

describe("disclosures", () => {
  it("holds exactly the six canonical disclosure ids", () => {
    expect(Object.keys(disclosures).sort()).toEqual(Object.keys(CANONICAL_TEXTS).sort());
  });

  for (const [id, text] of Object.entries(CANONICAL_TEXTS)) {
    it(`matches the canonical source text verbatim for "${id}"`, () => {
      expect(disclosures[id as keyof typeof disclosures].text).toBe(text);
    });
  }

  it("is frozen at both the record and entry level", () => {
    expect(Object.isFrozen(disclosures)).toBe(true);
    expect(Object.isFrozen(disclosures.simulation)).toBe(true);
  });
});

/**
 * Contextual microcopy pinned byte-for-byte, independently of its consumers
 * (Feature #240 follow-up; review finding R3-PRESIGN-NOT-PINNED). The route
 * tests assert these values by reference to `microcopy`, so without this map a
 * garbled literal — including the checklist reconciled to the vault invocation
 * in #258 — would pass every one of them.
 */
const PINNED_MICROCOPY: Record<string, string> = {
  humanDecision:
    "Esta decisión la registra una persona. La recomendación de IA no aprueba ni transfiere fondos.",
  aiFallback: "Respuesta de respaldo previamente generada; no corresponde a una llamada en vivo",
  testAssetNoValue: "Activo de prueba sin valor económico",
  preSignCheck: "Verifica cuenta, red, el contrato de la bóveda, el activo y el monto en Freighter",
  submittedNotConfirmed: "La transacción fue enviada, pero todavía no está confirmada",
  hashTechnicalOnly:
    "El hash demuestra ejecución técnica en Testnet; no representa una inversión ni dinero real",
  deterministicCalculation: "Cálculo determinístico; la IA no calcula esta obligación",
  priorRunHash: "Hash de ensayo previo; no corresponde a la ejecución actual",
  kycSimulated: "Resultado simulado para esta demo; no constituye una verificación de identidad",
  salesSynthetic:
    "Serie sintética y reproducible; abril está ausente y junio contiene una anomalía intencional",
  kycStatusLabel: "KYC aprobado · SIMULADO",
  testnetBadge: "TESTNET · Activos sin valor económico"
};

describe("microcopy", () => {
  it("holds exactly the pinned contextual labels", () => {
    expect(Object.keys(microcopy).sort()).toEqual(Object.keys(PINNED_MICROCOPY).sort());
  });

  for (const [key, value] of Object.entries(PINNED_MICROCOPY)) {
    it(`matches the pinned literal verbatim for "${key}"`, () => {
      expect(microcopy[key as keyof typeof microcopy]).toBe(value);
    });
  }
});
