import type { AiRiskBand } from "@/application/ports/ai-evaluation-port";

/**
 * Pure copy and state of the PyME onboarding wizard's step 3 («Evaluación AI»,
 * Feature #398, Task #399 / T5). React-free so the copy and the risk-band
 * labels are unit-tested without rendering.
 *
 * Copy is verbatim from the owner's template
 * `docs/design/template/Vaqcrow Onboarding PyME.dc.html` (export 2026-10-03),
 * lines 199–225. The band is text + icon, never colour alone: `riskBandLabel`
 * always names it. Feature #402 replaced the template's four mock checks with
 * the API's real completeness findings (see `./completeness`).
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
