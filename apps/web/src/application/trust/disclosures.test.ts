import { describe, expect, it } from "vitest";
import { disclosures } from "./disclosures";

// Canonical texts quoted verbatim from docs/planning/DEMO.md §12 and
// docs/design/demo-ui.md §2 — byte-for-byte, including punctuation.
const CANONICAL_TEXTS: Record<string, string> = {
  simulation:
    "Demostración con datos simulados. La identidad, el KYC/KYB, las ventas y la conversión ARS/activo Stellar de este caso son sintéticos. No representan verificaciones ni movimientos de dinero real.",
  testnet:
    "Stellar Testnet. Las transacciones mostradas usan activos sin valor económico en Stellar Testnet. Un hash de Testnet demuestra ejecución técnica, no una inversión real ni disponibilidad en producción.",
  "non-custody":
    "Firma no custodial. Freighter es la wallet e interfaz de firma. La persona usuaria conserva sus claves; Vaqcrow construye y verifica la transacción y nunca recibe su seed.",
  "human-ai":
    "IA con supervisión humana. La IA organiza evidencia, identifica anomalías y propone una evaluación explicable. No inventa datos, no toma la decisión final, no calcula obligaciones financieras y no transfiere fondos.",
  "no-production":
    "No apto para producción. Esta demo no constituye una oferta de inversión, recomendación financiera, aprobación regulatoria ni prueba de legalidad, rentabilidad, solvencia, custodia, calidad de proveedores u operación en Argentina."
};

describe("disclosures", () => {
  it("holds exactly the five canonical disclosure ids", () => {
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
