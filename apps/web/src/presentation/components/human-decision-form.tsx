"use client";

import { useId, useState } from "react";
import {
  ACTOR_MAX_LENGTH,
  REASON_MAX_LENGTH,
  validateDecisionForm,
  type DecisionFormField,
  type DecisionFormValues,
  type DecisionInput
} from "@/application/decision/decision-form";
import type { DecisionSubmitError } from "@/application/decision/human-decision-errors";
import { Button } from "./button";
import { TextArea } from "./text-area";
import { TextField } from "./text-field";

/**
 * HumanDecisionForm (Issue #62 T6; migrated to the shared `TextField`/
 * `TextArea`/`Button` primitives under Issue #306 / T3). The explicit,
 * human-only decision. Nothing is pre-selected and the AI recommendation
 * never enables or fills anything here. Local validation only mirrors the
 * contract for fast feedback; the backend stays authoritative and its
 * outcome is shown via `error`.
 *
 * The outcome fieldset stays a native `<input type="radio">` group (out of
 * T3's scope, already guarded by `human-decision.spec.ts`): no shared radio
 * primitive exists yet.
 */
export interface HumanDecisionFormProps {
  readonly defaultActor: string;
  readonly onSubmit: (input: DecisionInput) => void | Promise<void>;
  readonly error?: DecisionSubmitError;
  readonly isSubmitting?: boolean;
}

const OUTCOMES: ReadonlyArray<{ readonly value: "approved" | "changes_requested" | "rejected"; readonly label: string }> = [
  { value: "approved", label: "Aprobar" },
  { value: "changes_requested", label: "Solicitar información" },
  { value: "rejected", label: "Rechazar" }
];

export function HumanDecisionForm({ defaultActor, onSubmit, error, isSubmitting = false }: HumanDecisionFormProps) {
  const idPrefix = useId();
  const [values, setValues] = useState<DecisionFormValues>({
    outcome: "",
    actor: defaultActor,
    reason: "",
    approvedLimitArs: ""
  });
  const [fieldErrors, setFieldErrors] = useState<Readonly<Partial<Record<DecisionFormField, string>>>>({});

  const update = (patch: Partial<DecisionFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    setFieldErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch) as DecisionFormField[]) delete next[key];
      return next;
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = validateDecisionForm(values);
    if (!result.ok) {
      setFieldErrors(result.errors);
      return;
    }
    setFieldErrors({});
    void onSubmit(result.input);
  };

  const fieldError = (field: DecisionFormField) =>
    fieldErrors[field] ? (
      <span id={`${idPrefix}-${field}-error`} role="alert" className="text-sm text-trust-critical">
        {fieldErrors[field]}
      </span>
    ) : null;

  const describedBy = (field: DecisionFormField) => (fieldErrors[field] ? `${idPrefix}-${field}-error` : undefined);

  return (
    <form
      lang="es"
      noValidate
      aria-label="Decisión humana"
      className="flex flex-col gap-4 rounded-card border border-border p-6"
      onSubmit={handleSubmit}
    >
      <h3 className="m-0 text-lg font-bold tracking-[-0.01em]">Decisión humana</h3>
      <p className="m-0 text-sm">
        La decisión la registra una persona. La IA no aprueba ni define el límite: si aprobás, el límite lo fijás vos.
      </p>

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" aria-describedby={describedBy("outcome")}>
        <legend className="p-0 font-medium">Decisión</legend>
        {OUTCOMES.map((option) => (
          <label key={option.value} className="flex items-center gap-2">
            <input
              type="radio"
              name={`${idPrefix}-outcome`}
              value={option.value}
              checked={values.outcome === option.value}
              onChange={() => update({ outcome: option.value })}
            />
            {option.label}
          </label>
        ))}
        {fieldError("outcome")}
      </fieldset>

      <TextField
        label="Quién decide"
        value={values.actor}
        maxLength={ACTOR_MAX_LENGTH}
        {...(fieldErrors.actor ? { error: fieldErrors.actor } : {})}
        onChange={(value) => update({ actor: value })}
      />

      <TextArea
        label="Razón de la decisión"
        rows={4}
        value={values.reason}
        maxLength={REASON_MAX_LENGTH}
        isRequired
        {...(fieldErrors.reason ? { error: fieldErrors.reason } : {})}
        onChange={(value) => update({ reason: value })}
      />

      {values.outcome === "approved" ? (
        <TextField
          label="Límite aprobado (ARS)"
          type="text"
          inputMode="numeric"
          value={values.approvedLimitArs}
          isRequired
          {...(fieldErrors.approvedLimitArs ? { error: fieldErrors.approvedLimitArs } : {})}
          helperText="Pesos enteros, sin puntos. Monto simulado de la demo."
          onChange={(value) => update({ approvedLimitArs: value })}
        />
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-trust-critical">
          {error.message}
        </p>
      ) : null}

      <Button type="submit" isDisabled={isSubmitting}>
        {isSubmitting ? "Registrando…" : "Registrar decisión"}
      </Button>
    </form>
  );
}
