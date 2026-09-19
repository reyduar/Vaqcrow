"use client";

import { Button, Input, Label } from "@heroui/react";
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

/**
 * HumanDecisionForm (Issue #62 T6): the explicit, human-only decision. Nothing
 * is pre-selected and the AI recommendation never enables or fills anything
 * here. Local validation only mirrors the contract for fast feedback; the
 * backend stays authoritative and its outcome is shown via `error`.
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

const INPUT_CLASS = "w-full";
const TEXTAREA_CLASS =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2";

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
      className="flex max-w-xl flex-col gap-4"
      onSubmit={handleSubmit}
    >
      <h3 className="text-lg font-semibold">Decisión humana</h3>
      <p className="text-sm">
        La decisión la registra una persona. La IA no aprueba ni define el límite: si aprobás, el límite lo fijás vos.
      </p>

      <fieldset className="flex flex-col gap-2" aria-describedby={describedBy("outcome")}>
        <legend className="font-medium">Decisión</legend>
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

      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-actor`}>Quién decide</Label>
        <Input
          id={`${idPrefix}-actor`}
          className={INPUT_CLASS}
          value={values.actor}
          maxLength={ACTOR_MAX_LENGTH}
          aria-invalid={fieldErrors.actor ? "true" : undefined}
          aria-describedby={describedBy("actor")}
          onChange={(event) => update({ actor: event.target.value })}
        />
        {fieldError("actor")}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-reason`}>Razón de la decisión</Label>
        <textarea
          id={`${idPrefix}-reason`}
          className={TEXTAREA_CLASS}
          rows={4}
          value={values.reason}
          maxLength={REASON_MAX_LENGTH}
          aria-required="true"
          aria-invalid={fieldErrors.reason ? "true" : undefined}
          aria-describedby={describedBy("reason")}
          onChange={(event) => update({ reason: event.target.value })}
        />
        {fieldError("reason")}
      </div>

      {values.outcome === "approved" ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${idPrefix}-limit`}>Límite aprobado (ARS)</Label>
          <Input
            id={`${idPrefix}-limit`}
            className={INPUT_CLASS}
            type="text"
            inputMode="numeric"
            value={values.approvedLimitArs}
            aria-required="true"
            aria-invalid={fieldErrors.approvedLimitArs ? "true" : undefined}
            aria-describedby={describedBy("approvedLimitArs")}
            onChange={(event) => update({ approvedLimitArs: event.target.value })}
          />
          <span className="text-sm text-muted">Pesos enteros, sin puntos. Monto simulado de la demo.</span>
          {fieldError("approvedLimitArs")}
        </div>
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
