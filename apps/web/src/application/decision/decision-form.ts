import type { HumanDecisionOutcome } from "@vaqcrow/contracts";

/** Raw browser form state. `outcome` starts empty: the human must choose explicitly. */
export interface DecisionFormValues {
  readonly outcome: HumanDecisionOutcome | "";
  readonly actor: string;
  readonly reason: string;
  /** Raw text; only meaningful (and only sent) for an approved decision. */
  readonly approvedLimitArs: string;
}

export type DecisionFormField = keyof DecisionFormValues;

/** Validated decision payload, before ids are attached. Mirrors the contract invariant. */
export interface DecisionInput {
  readonly outcome: HumanDecisionOutcome;
  readonly actor: string;
  readonly reason: string;
  /** Positive safe integer for `approved`, exactly `null` otherwise. */
  readonly approvedLimitArs: number | null;
}

export type DecisionFormResult =
  | { readonly ok: true; readonly input: DecisionInput }
  | { readonly ok: false; readonly errors: Readonly<Partial<Record<DecisionFormField, string>>> };

export const ACTOR_MAX_LENGTH = 120;
export const REASON_MAX_LENGTH = 1000;

const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;

/**
 * Client-side validation is a convenience: the backend re-validates the same
 * contract and stays authoritative. Messages are authored here, never taken
 * from the backend.
 */
export function validateDecisionForm(values: DecisionFormValues): DecisionFormResult {
  const errors: Partial<Record<DecisionFormField, string>> = {};
  const actor = values.actor.trim();
  const reason = values.reason.trim();

  if (values.outcome === "") errors.outcome = "Elegí una decisión.";
  if (actor.length === 0) errors.actor = "Indicá quién registra la decisión.";
  else if (actor.length > ACTOR_MAX_LENGTH) errors.actor = `Máximo ${ACTOR_MAX_LENGTH} caracteres.`;
  if (reason.length === 0) errors.reason = "La razón es obligatoria.";
  else if (reason.length > REASON_MAX_LENGTH) errors.reason = `Máximo ${REASON_MAX_LENGTH} caracteres.`;

  let approvedLimitArs: number | null = null;
  if (values.outcome === "approved") {
    const raw = values.approvedLimitArs.trim();
    const parsed = POSITIVE_INTEGER_PATTERN.test(raw) ? Number(raw) : Number.NaN;
    if (Number.isSafeInteger(parsed)) approvedLimitArs = parsed;
    else errors.approvedLimitArs = "Ingresá un límite en pesos: un número entero positivo, sin puntos ni símbolos.";
  }

  if (Object.keys(errors).length > 0 || values.outcome === "") return { ok: false, errors };
  return { ok: true, input: { outcome: values.outcome, actor, reason, approvedLimitArs } };
}

/** Stable identity of a payload; equal fingerprints mean "the same decision attempt". */
export function decisionFingerprint(input: DecisionInput): string {
  return JSON.stringify([input.outcome, input.actor, input.reason, input.approvedLimitArs]);
}
