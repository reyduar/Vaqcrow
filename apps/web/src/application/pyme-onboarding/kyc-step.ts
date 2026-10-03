import type { KycDocument, KycOutcome, KycResult } from "@/application/ports/kyc-port";

/**
 * Pure model of the PyME onboarding wizard's step 1 (simulated KYC), React-free
 * so the state machine and the copy are unit-tested without rendering.
 *
 * Copy is verbatim from the owner's template
 * `docs/design/template/Vaqcrow Onboarding PyME.dc.html` (export 2026-10-03):
 * lines 109–117 (stepper), 120–155 (step 1) and 344–348 (KYC outcomes). The
 * four steps are the template's, not the three of #398's prose (D12).
 */

export type WizardStepId = "kyc" | "registration" | "ai" | "review";

export interface WizardStepDefinition {
  readonly id: WizardStepId;
  readonly label: string;
}

/** Template line 312: `['KYC', 'Registro PyME', 'Evaluación AI', 'Revisión humana']`. */
export const WIZARD_STEPS: readonly WizardStepDefinition[] = Object.freeze([
  { id: "kyc", label: "KYC" },
  { id: "registration", label: "Registro PyME" },
  { id: "ai", label: "Evaluación AI" },
  { id: "review", label: "Revisión humana" }
] as const);

export interface WizardStepState extends WizardStepDefinition {
  readonly n: number;
  readonly done: boolean;
  readonly current: boolean;
}

/**
 * Stepper state for a 0-based current index: earlier steps are done, the
 * current one carries `aria-current="step"`. Only step 1 is reachable in this
 * unit (T1); later units drive the index forward.
 */
export function wizardStepStates(currentIndex: number): readonly WizardStepState[] {
  return WIZARD_STEPS.map((step, index) => ({
    ...step,
    n: index + 1,
    done: index < currentIndex,
    current: index === currentIndex
  }));
}

/** The provider label shown while verifying and in the result's `<dl>`. */
export const KYC_PROVIDER_LABEL = "Adaptador KYC simulado v1";

/** Template line 133: the two synthetic documents, in order and verbatim. */
export const KYC_DOCUMENT_OPTIONS: readonly { readonly value: KycDocument; readonly label: string }[] = Object.freeze([
  { value: "person_a", label: "DNI sintético · Persona A (responsable)" },
  { value: "person_b", label: "DNI sintético · Persona B (socia)" }
]);

export const KYC_STEP_COPY = Object.freeze({
  heading: "Verificación de identidad",
  subtitle:
    "KYC/KYB de la persona responsable y de la empresa. En esta demo el resultado es simulado y no se procesa ningún documento real.",
  documentLabel: "Documento",
  dropzoneTitle: "Elegí un documento de prueba",
  dropzoneBody: "Usamos identidades sintéticas para que la demo nunca pida datos personales reales.",
  busyTitle: "Verificando con el adaptador simulado…",
  approvedTitle: "KYC aprobado · SIMULADO",
  approvedBody: "Identidad y empresa verificadas por el adaptador simulado.",
  changesTitle: "Requiere cambios · SIMULADO",
  changesBody: "El documento de prueba no coincide con la razón social. Elegí otro documento y volvé a intentar.",
  referenceLabel: "Referencia",
  providerLabel: "Proveedor",
  asideTitle: "¿POR QUÉ KYC?",
  asideParagraph1:
    "En un producto real, conocer a la persona y a la empresa previene fraude y lavado de dinero antes de publicar una campaña."
});

/**
 * Template line 153, split so the component can emphasise `SIMULADO` in bold
 * without slicing a string or colouring meaning (the text itself is the signal).
 */
export const KYC_ASIDE_PARAGRAPH_2 = Object.freeze({
  lead: "En esta demo el paso existe para mostrar el flujo: el resultado queda marcado como ",
  emphasis: "SIMULADO",
  tail: " en cada pantalla donde aparece."
});

/** The three phases of the step-1 state machine. */
export type KycPhase = "idle" | "busy" | "done";

/** Template line 347–348, verbatim. */
export const KYC_PRIMARY_LABELS = Object.freeze({
  idle: "Iniciar verificación simulada",
  busy: "Verificando…",
  approved: "Siguiente paso",
  changes: "Volver a intentar"
});

export const KYC_SECONDARY_LABELS = Object.freeze({
  idle: "Usar archivo de prueba",
  other: "Elegir otro documento"
});

export type KycPrimaryAction = "verify" | "next" | "retry";
export type KycSecondaryAction = "verify" | "choose-another";
export type KycPrimaryIcon = "scan" | "arrow-forward" | "refresh";

export function kycPrimaryLabel(phase: KycPhase, outcome: KycOutcome | null): string {
  if (phase === "idle") return KYC_PRIMARY_LABELS.idle;
  if (phase === "busy") return KYC_PRIMARY_LABELS.busy;
  return outcome === "approved" ? KYC_PRIMARY_LABELS.approved : KYC_PRIMARY_LABELS.changes;
}

export function kycSecondaryLabel(phase: KycPhase): string {
  return phase === "idle" ? KYC_SECONDARY_LABELS.idle : KYC_SECONDARY_LABELS.other;
}

export function kycPrimaryAction(phase: KycPhase, outcome: KycOutcome | null): KycPrimaryAction {
  if (phase === "idle" || phase === "busy") return "verify";
  return outcome === "approved" ? "next" : "retry";
}

export function kycSecondaryAction(phase: KycPhase): KycSecondaryAction {
  return phase === "idle" ? "verify" : "choose-another";
}

/** Template line 347: `scan-outline` idle, `arrow-forward-outline` approved, `refresh-outline` otherwise. */
export function kycPrimaryIcon(phase: KycPhase, outcome: KycOutcome | null): KycPrimaryIcon {
  if (phase === "idle") return "scan";
  return outcome === "approved" ? "arrow-forward" : "refresh";
}

export interface KycResultCopy {
  readonly title: string;
  readonly body: string;
  readonly tone: "approved" | "changes";
}

/** Template lines 344–345: the done block's title, body and status treatment. */
export function kycResultCopy(phase: KycPhase, result: KycResult | null): KycResultCopy | null {
  if (phase !== "done" || result === null) return null;
  return result.outcome === "approved"
    ? { title: KYC_STEP_COPY.approvedTitle, body: KYC_STEP_COPY.approvedBody, tone: "approved" }
    : { title: KYC_STEP_COPY.changesTitle, body: KYC_STEP_COPY.changesBody, tone: "changes" };
}
