/**
 * Canonical trust-disclosure copy for the demo (Feature #17 / Task #53;
 * reconciled with contract custody in Feature #240).
 *
 * These six texts are quoted verbatim from `docs/planning/DEMO.md` §12
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
  | "contract-custody"
  | "human-ai"
  | "no-production";

export interface Disclosure {
  readonly id: DisclosureId;
  /** Short lead phrase, no trailing period — used as a heading. */
  readonly title: string;
  /** The canonical text after the lead sentence, verbatim. */
  readonly body: string;
  /** Full canonical text, verbatim and unabbreviated, including the lead sentence: `${title}. ${body}`. */
  readonly text: string;
  readonly banner: DisclosureBannerVariant;
}

/**
 * Builds a disclosure from its lead title and body so a consumer that styles
 * the lead apart (e.g. the auth screen footer) never slices `text` by offset.
 */
function disclosure(id: DisclosureId, title: string, body: string, banner: DisclosureBannerVariant): Disclosure {
  return Object.freeze({ id, title, body, text: `${title}. ${body}`, banner });
}

export const disclosures: Readonly<Record<DisclosureId, Disclosure>> = Object.freeze({
  simulation: disclosure(
    "simulation",
    "Demostración con datos simulados",
    "El KYC/KYB, el historial de ventas y la conversión ARS/activo Stellar son simulados. Las cuentas son reales, pero no representan una verificación de identidad ni movimientos de dinero real.",
    "simulation"
  ),
  testnet: disclosure(
    "testnet",
    "Stellar Testnet",
    "Las transacciones mostradas usan activos sin valor económico en Stellar Testnet. Un hash de Testnet demuestra ejecución técnica, no una inversión real ni disponibilidad en producción.",
    "testnet"
  ),
  "non-custody": disclosure(
    "non-custody",
    "Firma no custodial",
    "Freighter es la wallet e interfaz de firma. La persona usuaria conserva sus claves; Vaqcrow construye y verifica la transacción y nunca recibe su seed.",
    "simulation"
  ),
  "contract-custody": disclosure(
    "contract-custody",
    "Custodia por contrato",
    "Durante la campaña, los aportes los custodia el contrato, no una persona: nadie tiene una clave para moverlos. El contrato sólo puede pagar al destino fijo definido al abrir la bóveda, y ese destino es inmutable. La meta la evalúa el contrato sobre el ledger y, al alcanzarla, liquida a la PyME en la misma transacción. No hay recuperación ni clawback: no existe forma de revertir un pago ya liquidado, y los fondos que nadie reclame sólo pueden salir por el barrido; si no, pueden quedarse en el contrato. El reembolso por vencimiento no se dispara solo: exige que alguien envíe la transacción, y es permissionless porque el destino ya está fijado.",
    "simulation"
  ),
  "human-ai": disclosure(
    "human-ai",
    "IA con supervisión humana",
    "La IA organiza evidencia, identifica anomalías y propone una evaluación explicable. No inventa datos, no toma la decisión final, no calcula obligaciones financieras y no transfiere fondos.",
    "simulation"
  ),
  "no-production": disclosure(
    "no-production",
    "No apto para producción",
    "Esta demo no constituye una oferta de inversión, recomendación financiera, aprobación regulatoria ni prueba de legalidad, rentabilidad, solvencia, custodia, calidad de proveedores u operación en Argentina.",
    "simulation"
  )
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
  testnetBadge: "TESTNET · Activos sin valor económico",
  /**
   * `docs/design/demo-ui.md:1173`: "Wrong network must block signing and
   * say 'Cambia a Stellar Testnet para continuar'." Added 2026-09-27, owner
   * approved, after native review found the wrong-network alert could
   * otherwise render empty (see `TransactionReviewModal`'s
   * `TransactionReviewNetworkState` doc comment).
   */
  wrongNetwork: "Cambia a Stellar Testnet para continuar"
} as const;
