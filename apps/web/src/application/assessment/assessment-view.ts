/**
 * The web's view model for a real assessment, and the parser that admits one.
 *
 * This is deliberately NOT the model-output contract. That contract lives in
 * `packages/ai`, and `apps/web` is forbidden from importing it — the boundary
 * rule `web-never-imports-ai` exists so the browser bundle never carries the
 * assessment validation logic. What the screen needs is narrower: the fields it
 * renders, plus the provenance `DEMO.md` §5 requires it to show.
 *
 * The parser is hand-written rather than schema-based because this package
 * carries no validation library, and adding one to the browser bundle for a
 * single response is a worse trade than thirty lines of explicit narrowing. It
 * is strict about the envelope and about every field the screen reads: a
 * response that drifted is an error the operator sees, never a half-rendered
 * panel.
 */

export const ASSESSMENT_RISK_BANDS = ["low", "medium", "high"] as const;
export type AssessmentRiskBand = (typeof ASSESSMENT_RISK_BANDS)[number];

/** The only action the model may recommend. Mirrors the closed set in `packages/ai`. */
export const ASSESSMENT_RECOMMENDED_ACTION = "human_review" as const;

export interface AssessmentViewReason {
  readonly claim: string;
  readonly evidenceRefs: readonly string[];
}

export interface AssessmentViewAnomaly {
  readonly type: string;
  readonly evidenceRef: string;
  readonly severity: string;
}

/**
 * `source` is carried through rather than hidden: a simulated evaluation must
 * never be presented as a real one, so the screen can label it.
 */
export interface AssessmentProvenance {
  readonly model: string;
  readonly promptVersion: string;
  readonly generatedAt: string;
  readonly source: "provider" | "simulated";
}

export interface AssessmentView {
  readonly assessmentId: string;
  readonly riskBand: AssessmentRiskBand;
  readonly confidence: number;
  readonly reasons: readonly AssessmentViewReason[];
  readonly anomalies: readonly AssessmentViewAnomaly[];
  readonly missingData: readonly string[];
  readonly recommendedAction: typeof ASSESSMENT_RECOMMENDED_ACTION;
  readonly questions: readonly string[];
  readonly provenance: AssessmentProvenance;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`Invalid assessment response: ${field}`);
  }
  return value;
}

function readStringArray(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`Invalid assessment response: ${field}`);
  }
  return value.map((entry) => readString(entry, field));
}

function parseReason(value: unknown): AssessmentViewReason {
  if (!isRecord(value)) {
    throw new TypeError("Invalid assessment response: reasons[]");
  }

  const evidenceRefs = readStringArray(value["evidenceRefs"], "reasons[].evidenceRefs");
  // The model contract already requires at least one citation, so an uncited
  // claim means the response drifted. Rendering it as an explained claim is
  // exactly the failure the guardrail exists to prevent.
  if (evidenceRefs.length === 0) {
    throw new TypeError("Invalid assessment response: reasons[].evidenceRefs");
  }

  return { claim: readString(value["claim"], "reasons[].claim"), evidenceRefs };
}

function parseAnomaly(value: unknown): AssessmentViewAnomaly {
  if (!isRecord(value)) {
    throw new TypeError("Invalid assessment response: anomalies[]");
  }
  return {
    type: readString(value["type"], "anomalies[].type"),
    evidenceRef: readString(value["evidenceRef"], "anomalies[].evidenceRef"),
    severity: readString(value["severity"], "anomalies[].severity")
  };
}

function parseProvenance(value: unknown): AssessmentProvenance {
  if (!isRecord(value)) {
    throw new TypeError("Invalid assessment response: metadata");
  }

  const source = value["source"];
  if (source !== "provider" && source !== "simulated") {
    throw new TypeError("Invalid assessment response: metadata.source");
  }

  return {
    model: readString(value["model"], "metadata.model"),
    promptVersion: readString(value["promptVersion"], "metadata.promptVersion"),
    generatedAt: readString(value["generatedAt"], "metadata.generatedAt"),
    source
  };
}

/** Admits exactly `{ assessment, metadata }`; anything else is a drifted response. */
export function parseAssessmentView(body: unknown): AssessmentView {
  if (!isRecord(body)) {
    throw new TypeError("Invalid assessment envelope");
  }

  const { assessment, metadata, ...extra } = body;
  if (Object.keys(extra).length > 0) {
    throw new TypeError("Invalid assessment envelope");
  }

  if (!isRecord(assessment)) {
    throw new TypeError("Invalid assessment envelope");
  }

  const riskBand = assessment["riskBand"];
  if (typeof riskBand !== "string" || !(ASSESSMENT_RISK_BANDS as readonly string[]).includes(riskBand)) {
    throw new TypeError("Invalid assessment response: riskBand");
  }

  const confidence = assessment["confidence"];
  if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new TypeError("Invalid assessment response: confidence");
  }

  if (assessment["recommendedAction"] !== ASSESSMENT_RECOMMENDED_ACTION) {
    throw new TypeError("Invalid assessment response: recommendedAction");
  }

  const reasons = assessment["reasons"];
  const anomalies = assessment["anomalies"];
  if (!Array.isArray(reasons) || !Array.isArray(anomalies)) {
    throw new TypeError("Invalid assessment response: reasons/anomalies");
  }

  return {
    assessmentId: readString(assessment["assessmentId"], "assessmentId"),
    riskBand: riskBand as AssessmentRiskBand,
    confidence,
    reasons: reasons.map(parseReason),
    anomalies: anomalies.map(parseAnomaly),
    missingData: readStringArray(assessment["missingData"], "missingData"),
    recommendedAction: ASSESSMENT_RECOMMENDED_ACTION,
    questions: readStringArray(assessment["questions"], "questions"),
    provenance: parseProvenance(metadata)
  };
}
