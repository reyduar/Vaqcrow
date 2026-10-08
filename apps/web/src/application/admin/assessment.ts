import type { ApplicationAssessmentRead } from "@vaqcrow/contracts";

/**
 * Pure model of section «2 · Recomendación de IA» of the admin review
 * (`Vaqcrow Admin.dc.html`, view `review`; Feature #410 / U4), React-free.
 *
 * The section is advisory only: it renders what the persisted assessment says
 * and never a decision. The template shows one list mixing reasons, anomalies
 * (in its warn color), missing data («Faltante: …») and suggested questions
 * («Pregunta sugerida: …»), in that order, and a footer «{modelo} ·
 * {dd/mm/aaaa hh:mm} · corr {id}». The read contract carries no correlation
 * id, so the footer stops at the timestamp instead of inventing one (open
 * question in the task log).
 */

type RiskBand = ApplicationAssessmentRead["assessment"]["riskBand"];
type Anomaly = ApplicationAssessmentRead["assessment"]["anomalies"][number];

export type AssessmentRiskTone = "neutral" | "caution" | "critical";
/** One icon per band so the chip never relies on color alone. */
export type AssessmentRiskIcon = RiskBand;

export interface AssessmentRiskChip {
  readonly label: string;
  readonly icon: AssessmentRiskIcon;
  readonly tone: AssessmentRiskTone;
}

export type AssessmentItem =
  | { readonly kind: "reason"; readonly text: string; readonly evidence: string }
  | { readonly kind: "anomaly" | "missing" | "question"; readonly text: string };

export type AssessmentSectionView =
  | { readonly kind: "empty"; readonly message: string }
  | {
      readonly kind: "assessment";
      readonly risk: AssessmentRiskChip;
      readonly confidenceLabel: string;
      readonly items: readonly AssessmentItem[];
      readonly footer: string;
      readonly simulated: boolean;
    };

export const ASSESSMENT_COPY = Object.freeze({
  title: "2 · Recomendación de IA",
  advisory: "Consultiva · no aprueba",
  simulated: "SIMULADO",
  /** Reused from the legacy human-decision screen; the template does not design this state. */
  empty: "Todavía no hay ninguna evaluación de IA registrada para esta solicitud.",
  missingTimestamp: "Sin dato"
});

/**
 * Template: «Riesgo medio» on the warn surface. Low/high are not designed;
 * they follow the legacy panel's tones (neutral / critical). Green is never
 * used: `demo-ui.md` §2 keeps it for ledger-confirmed outcomes.
 */
const RISK_CHIPS: Readonly<Record<RiskBand, AssessmentRiskChip>> = Object.freeze({
  low: { label: "Riesgo bajo", icon: "low", tone: "neutral" },
  medium: { label: "Riesgo medio", icon: "medium", tone: "caution" },
  high: { label: "Riesgo alto", icon: "high", tone: "critical" }
});

const ANOMALY_TYPE: Readonly<Record<Anomaly["type"], string>> = Object.freeze({
  outlier: "valor atípico",
  contradiction: "contradicción"
});

const ANOMALY_SEVERITY: Readonly<Record<Anomaly["severity"], string>> = Object.freeze({
  review: "a revisar",
  info: "informativa"
});

/** Displayed time zone: the demo operates in Argentina, whatever the viewer's clock says. */
const DISPLAY_TIME_ZONE = "America/Argentina/Buenos_Aires";

const TIMESTAMP_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: DISPLAY_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

/** «0,72»: two decimals with a Spanish decimal comma, as the template writes it. */
export function formatAssessmentConfidence(confidence: number): string {
  return confidence.toFixed(2).replace(".", ",");
}

/** `dd/mm/aaaa hh:mm` in Argentina's time zone, or `Sin dato` when unreadable. */
export function formatAssessmentTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return ASSESSMENT_COPY.missingTimestamp;
  const parts = Object.fromEntries(TIMESTAMP_FORMAT.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

export function assessmentSectionFor(read: ApplicationAssessmentRead | null): AssessmentSectionView {
  if (read === null) return { kind: "empty", message: ASSESSMENT_COPY.empty };
  const { assessment, metadata } = read;

  const items: AssessmentItem[] = [
    ...assessment.reasons.map((reason) => ({
      kind: "reason" as const,
      text: reason.claim,
      evidence: `Evidencia: ${reason.evidenceRefs.join(", ")}`
    })),
    ...assessment.anomalies.map((anomaly) => ({
      kind: "anomaly" as const,
      text: `Anomalía: ${ANOMALY_TYPE[anomaly.type]} en ${anomaly.evidenceRef} · ${ANOMALY_SEVERITY[anomaly.severity]}`
    })),
    ...assessment.missingData.map((missing) => ({ kind: "missing" as const, text: `Faltante: ${missing}` })),
    ...assessment.questions.map((question) => ({ kind: "question" as const, text: `Pregunta sugerida: ${question}` }))
  ];

  return {
    kind: "assessment",
    risk: RISK_CHIPS[assessment.riskBand],
    confidenceLabel: `Confianza ${formatAssessmentConfidence(assessment.confidence)}`,
    items,
    footer: `${metadata.model} · ${formatAssessmentTimestamp(read.recordedAt)}`,
    simulated: metadata.source === "simulated"
  };
}
