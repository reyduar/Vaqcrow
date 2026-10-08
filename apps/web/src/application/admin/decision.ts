import type { ApplicationReviewState, HumanDecisionOutcome, HumanDecisionRecord } from "@vaqcrow/contracts";
import type {
  AdminReviewCompany,
  RecordDecisionFailure,
  RecordDecisionRequest
} from "@/application/ports/admin-review-port";
import { microcopy } from "@/application/trust/disclosures";
import { formatAssessmentTimestamp } from "./assessment";

/**
 * Pure model of section «3 · Decisión humana» of the admin review (`Vaqcrow
 * Admin.dc.html`, view `review`; Feature #410 / U5), React-free.
 *
 * A person records the decision; the AI recommendation never approves. The
 * approved limit is not typed by the admin (D7): it is the goal the PyME
 * declared, read-only, and travels as `approvedLimitArs` only for an approval.
 * The actor is the verified admin on the server, never part of the request.
 */

export const DECISION_REASON_MIN_LENGTH = 10;
export const DECISION_REASON_MAX_LENGTH = 1000;

export type DecisionOptionIcon = "check" | "edit" | "close";
export type DecisionOptionTone = "success" | "info" | "critical";

export interface DecisionOption {
  readonly value: HumanDecisionOutcome;
  readonly label: string;
  readonly icon: DecisionOptionIcon;
  readonly tone: DecisionOptionTone;
}

/** The template's `verdicts`: aprobar (ok), cambios (info), rechazar (err). */
export const DECISION_OPTIONS: readonly DecisionOption[] = Object.freeze([
  { value: "approved", label: "Aprobar con límite", icon: "check", tone: "success" },
  { value: "changes_requested", label: "Requiere cambios", icon: "edit", tone: "info" },
  { value: "rejected", label: "Rechazar", icon: "close", tone: "critical" }
]);

/** The template's `decidedLabel`. */
const OUTCOME_LABEL: Readonly<Record<HumanDecisionOutcome, string>> = Object.freeze({
  approved: "Aprobada",
  changes_requested: "Requiere cambios",
  rejected: "Rechazada"
});

/**
 * Template texts verbatim, then copy the template does not design (open
 * questions in the task log): minimal, neutral and never claiming a decision
 * was recorded when it was not confirmed.
 */
export const DECISION_COPY = Object.freeze({
  title: "3 · Decisión humana",
  notice: microcopy.humanDecision,
  groupLabel: "Decisión",
  reasonLabel: "Razón",
  reasonPlaceholder: "Obligatoria. Queda visible en el detalle de la campaña.",
  limitLabel: "Límite aprobado (ARS)",
  submit: "Registrar decisión",
  dialogTitle: "Registrar decisión",
  cancel: "Cancelar",
  confirm: "Confirmar",
  outcomeRequired: "Elegí una decisión.",
  reasonTooShort: `La razón debe tener al menos ${DECISION_REASON_MIN_LENGTH} caracteres.`,
  reasonTooLong: `Máximo ${DECISION_REASON_MAX_LENGTH} caracteres.`,
  limitHint: "Es el objetivo que declaró la PyME; no se edita.",
  limitMissing: "Sin dato",
  approvalUnavailable: "No se puede aprobar: la PyME no tiene un objetivo de financiamiento registrado.",
  formClosed: "La decisión se habilita cuando la solicitud está en revisión humana.",
  decidedWithoutRecord: "Esta solicitud ya tiene una decisión registrada.",
  submitting: "Registrando…",
  alreadyDecided: "Esta solicitud ya tiene una decisión registrada. No se registró tu decisión.",
  notInReview: "Esta solicitud ya no está pendiente de revisión humana, por lo que no se registró tu decisión.",
  notFound: "No se encontró la solicitud en el servicio. No se registró nada.",
  invalidRequest: "El servicio rechazó los datos de la decisión. Revisalos e intentá de nuevo. No se registró nada.",
  notRecorded: "No pudimos registrar la decisión. No se registró nada; podés reintentar.",
  unconfirmed:
    "No pudimos confirmar que la decisión se haya registrado. Reintentar es seguro: si ya se guardó, no se duplica."
});

const DECIDED_STATES: ReadonlySet<ApplicationReviewState> = new Set(["approved", "changes_requested", "rejected"]);

const LIMIT_FORMAT = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/** D7: the PyME's declared goal, or `null` when there is none the contract would accept. */
export function approvedLimitFor(company: AdminReviewCompany | null): number | null {
  if (company === null) return null;
  return Number.isSafeInteger(company.goalArs) && company.goalArs > 0 ? company.goalArs : null;
}

/** «12.000.000», as the template writes the limit. */
export function formatApprovedLimit(limitArs: number): string {
  return LIMIT_FORMAT.format(limitArs);
}

export function decisionOutcomeLabel(outcome: HumanDecisionOutcome): string {
  return OUTCOME_LABEL[outcome];
}

/** The API takes a decision only in `human_review`, once. */
export function decisionFormOpen(state: ApplicationReviewState, latest: HumanDecisionRecord | null): boolean {
  return state === "human_review" && latest === null;
}

/** A final state without a decision row: shown read-only, never as an open form. */
export function decisionStateIsFinal(state: ApplicationReviewState): boolean {
  return DECIDED_STATES.has(state);
}

export interface DecisionDraft {
  readonly outcome: HumanDecisionOutcome | null;
  readonly reason: string;
  /** The read-only D7 limit, or `null` when approving is impossible. */
  readonly approvedLimitArs: number | null;
}

export type DecisionInput = Omit<RecordDecisionRequest, "decisionId">;

export type DecisionField = "outcome" | "reason";

export type DecisionValidation =
  | { readonly ok: true; readonly input: DecisionInput }
  | { readonly ok: false; readonly errors: Readonly<Partial<Record<DecisionField, string>>> };

/** Mirrors the contract (trimmed reason 10–1000, limit only for an approval); the API stays authoritative. */
export function validateDecision(draft: DecisionDraft): DecisionValidation {
  const errors: Partial<Record<DecisionField, string>> = {};
  const reason = draft.reason.trim();

  if (draft.outcome === null) errors.outcome = DECISION_COPY.outcomeRequired;
  else if (draft.outcome === "approved" && draft.approvedLimitArs === null) {
    errors.outcome = DECISION_COPY.approvalUnavailable;
  }
  if (reason.length < DECISION_REASON_MIN_LENGTH) errors.reason = DECISION_COPY.reasonTooShort;
  else if (reason.length > DECISION_REASON_MAX_LENGTH) errors.reason = DECISION_COPY.reasonTooLong;

  if (draft.outcome === null || Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    input: {
      outcome: draft.outcome,
      reason,
      approvedLimitArs: draft.outcome === "approved" ? draft.approvedLimitArs : null
    }
  };
}

/** Exactly the four body keys of `POST …/decisions`. */
export function buildDecisionRequest(decisionId: string, input: DecisionInput): RecordDecisionRequest {
  return {
    decisionId,
    outcome: input.outcome,
    reason: input.reason,
    approvedLimitArs: input.approvedLimitArs
  };
}

/** Equal fingerprints mean «the same submission», so a retry reuses its decision id. */
export function decisionFingerprint(input: DecisionInput): string {
  return JSON.stringify([input.outcome, input.reason, input.approvedLimitArs]);
}

/** The template's confirmation body; without a known name it still says who the decision is attributed to. */
export function decisionConfirmationBody(input: DecisionInput, adminName: string | null): string {
  const label =
    input.outcome === "approved" && input.approvedLimitArs !== null
      ? `Aprobada con límite ARS ${formatApprovedLimit(input.approvedLimitArs)}`
      : OUTCOME_LABEL[input.outcome];
  const name = adminName?.trim() ? adminName.trim() : "tu cuenta de administrador";
  return `${label}. Queda atribuida a ${name} y visible para la PyME y los aportantes.`;
}

/** «Registrada por {actor} · {fecha} · {resultado}», from the server's record. */
export function decisionStatusLine(record: HumanDecisionRecord): string {
  return `Registrada por ${record.actor} · ${formatAssessmentTimestamp(record.decidedAt)} · ${OUTCOME_LABEL[record.outcome]}`;
}

export function decisionFailureMessage(failure: RecordDecisionFailure): string {
  switch (failure.code) {
    case "state_conflict":
      return DECIDED_STATES.has(failure.actualState) ? DECISION_COPY.alreadyDecided : DECISION_COPY.notInReview;
    case "not_found":
      return DECISION_COPY.notFound;
    case "invalid_request":
      return DECISION_COPY.invalidRequest;
    case "idempotency_conflict":
      return DECISION_COPY.notRecorded;
    default:
      return DECISION_COPY.unconfirmed;
  }
}
