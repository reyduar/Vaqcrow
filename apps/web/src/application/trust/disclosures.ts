/**
 * Canonical trust-disclosure copy for the demo (Feature #17 / Task #53).
 *
 * These five texts are quoted verbatim from `docs/planning/DEMO.md` §12
 * "Claims y disclaimers exactos" and `docs/design/demo-ui.md` §2 "Reglas de
 * confianza no negociables". No route may paraphrase, abbreviate, or
 * duplicate this copy — every consumer imports these constants.
 */

/**
 * Visual treatment for a disclosure when rendered as a banner. Presentation
 * components (added in a later work unit) reuse this union rather than
 * defining their own, keeping disclosure identity and visual variant
 * declared once, in the data layer that owns the copy.
 */
export type DisclosureBannerVariant = "simulation" | "testnet" | "fallback" | "error";

export type DisclosureId =
  | "simulation"
  | "testnet"
  | "non-custody"
  | "human-ai"
  | "no-production";

export interface Disclosure {
  readonly id: DisclosureId;
  /** Short lead phrase, no trailing period — used as a heading. */
  readonly title: string;
  /** Full canonical text, verbatim and unabbreviated, including the lead sentence. */
  readonly text: string;
  readonly banner: DisclosureBannerVariant;
}

export const disclosures: Readonly<Record<DisclosureId, Disclosure>> = Object.freeze({
  simulation: Object.freeze({
    id: "simulation",
    title: "Demostración con datos simulados",
    text: "Demostración con datos simulados. La identidad, el KYC/KYB, las ventas y la conversión ARS/activo Stellar de este caso son sintéticos. No representan verificaciones ni movimientos de dinero real.",
    banner: "simulation"
  }),
  testnet: Object.freeze({
    id: "testnet",
    title: "Stellar Testnet",
    text: "Stellar Testnet. Las transacciones mostradas usan activos sin valor económico en Stellar Testnet. Un hash de Testnet demuestra ejecución técnica, no una inversión real ni disponibilidad en producción.",
    banner: "testnet"
  }),
  "non-custody": Object.freeze({
    id: "non-custody",
    title: "Firma no custodial",
    text: "Firma no custodial. Freighter es la wallet e interfaz de firma. La persona usuaria conserva sus claves; Vaqcrow construye y verifica la transacción y nunca recibe su seed.",
    banner: "simulation"
  }),
  "human-ai": Object.freeze({
    id: "human-ai",
    title: "IA con supervisión humana",
    text: "IA con supervisión humana. La IA organiza evidencia, identifica anomalías y propone una evaluación explicable. No inventa datos, no toma la decisión final, no calcula obligaciones financieras y no transfiere fondos.",
    banner: "simulation"
  }),
  "no-production": Object.freeze({
    id: "no-production",
    title: "No apto para producción",
    text: "No apto para producción. Esta demo no constituye una oferta de inversión, recomendación financiera, aprobación regulatoria ni prueba de legalidad, rentabilidad, solvencia, custodia, calidad de proveedores u operación en Argentina.",
    banner: "simulation"
  })
} as const);

/**
 * Contextual microcopy referenced beside a disclosure, a datum, or an
 * action. Every value is verbatim from `docs/design/demo-ui.md` §8
 * "Especificaciones de pantallas" (pantallas 2–6) and §10.2 "Labels y
 * microcopy de referencia" — never paraphrase.
 */
export const microcopy = {
  humanDecision:
    "Esta decisión la registra una persona. La recomendación de IA no aprueba ni transfiere fondos.",
  aiFallback: "Respuesta de respaldo previamente generada; no corresponde a una llamada en vivo",
  testAssetNoValue: "Activo de prueba sin valor económico",
  preSignCheck: "Verifica cuenta, red, destino, activo, monto y memo en Freighter",
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
} as const;
