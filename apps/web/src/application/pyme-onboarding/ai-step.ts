import type { AiCheckKind, AiEvaluationCheck, AiRiskBand } from "@/application/ports/ai-evaluation-port";

/**
 * Pure copy and state of the PyME onboarding wizard's step 3 («Evaluación AI»,
 * Feature #398, Task #399 / T5). React-free so the copy and the risk-band
 * labels are unit-tested without rendering.
 *
 * Copy is verbatim from the owner's template
 * `docs/design/template/Vaqcrow Onboarding PyME.dc.html` (export 2026-10-03),
 * lines 199–225. The result is simulated behind `AiEvaluationPort`; Feature
 * #402 swaps in the real completeness check. The band is text + icon, never
 * colour alone: `riskBandLabel` always names it.
 */

export const AI_STEP_COPY = Object.freeze({
  simulado: "SIMULADO",
  heading: "Evaluación AI",
  subtitle:
    "La IA ordena la evidencia que cargaste, marca faltantes y anomalías y propone una banda de riesgo. No aprueba ni rechaza: la decisión la toma una persona en el paso siguiente.",
  busyTitle: "Analizando tu solicitud…",
  busyBody: "Revisando KYC, ventas declaradas y archivos adjuntos.",
  riskLabel: "Banda de riesgo propuesta",
  riskSubject: "Sujeta a revisión humana",
  continueLabel: "Continuar",
  correctLabel: "Corregir datos",
  errorMessage: "No pudimos completar la evaluación. Probá de nuevo.",
  retryLabel: "Reintentar"
});

/** Every band is named in text (new copy where the template only designed «medio»). */
export const AI_RISK_LABELS: Readonly<Record<AiRiskBand, string>> = Object.freeze({
  low: "Riesgo bajo",
  medium: "Riesgo medio",
  high: "Riesgo alto"
});

export function riskBandLabel(band: AiRiskBand): string {
  return AI_RISK_LABELS[band];
}

/**
 * The simulated adapter's deterministic output: the template's four checks,
 * verbatim (lines 218–221). The titles read as data an AI organises; none of
 * them is a decision.
 */
export const AI_SIMULATED_CHECKS: readonly AiEvaluationCheck[] = Object.freeze([
  Object.freeze({
    kind: "ok" as AiCheckKind,
    title: "Identidad y empresa",
    body: "KYC simulado aprobado. CUIT y razón social coinciden."
  }),
  Object.freeze({
    kind: "ok" as AiCheckKind,
    title: "Ventas declaradas",
    body: "12 meses cargados. Coinciden con el archivo adjunto."
  }),
  Object.freeze({
    kind: "warning" as AiCheckKind,
    title: "Faltante",
    body: "No hay comprobante de domicilio comercial. Podés sumarlo después."
  }),
  Object.freeze({
    kind: "warning" as AiCheckKind,
    title: "Anomalía",
    body: "Marzo muestra ventas 38% más altas que el promedio. La persona revisora va a pedir contexto."
  })
]);
