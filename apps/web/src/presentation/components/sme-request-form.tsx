"use client";

import { useState } from "react";
import { Controller, useForm, type RegisterOptions } from "react-hook-form";
import type {
  SmeRequestFormField,
  SmeRequestFormValues,
  SmeRequestSubmitError
} from "@/application/evidence/review-view-model";
import { Badge } from "./badge";
import { Button } from "./button";
import { TextField } from "./text-field";

/**
 * SmeRequestForm (Task #56 / T4; migrated to the shared `TextField`/`Button`
 * primitives under Issue #306 / T3). React Hook Form owns only browser form
 * state plus required/format hints. Business validation (totals, period
 * order, contracts) stays with the backend: values are handed to `onSubmit`
 * as raw strings and `submitError` is rendered verbatim, never interpreted.
 *
 * `TextField` is a controlled component (`value`/`onChange(value: string)`),
 * not a ref-forwarding one, so each field is wired through RHF's `Controller`
 * instead of `register()` — the officially supported pattern for a custom
 * controlled input. `field.onChange` accepts the raw string directly (RHF
 * treats a non-event argument as the new value), so the "pass raw strings
 * through untouched" contract and the per-field `dismiss` callback both carry
 * over unchanged.
 */
export interface SmeRequestFormProps {
  /** SIMULADO label sourced from the fixture/request record, never hardcoded here. */
  readonly simuladoLabel: string;
  readonly onSubmit: (values: SmeRequestFormValues) => void | Promise<void>;
  readonly submitError?: SmeRequestSubmitError;
  readonly isSubmitting?: boolean;
}

interface Dismissal {
  readonly forError: SmeRequestSubmitError | undefined;
  readonly fields: readonly SmeRequestFormField[];
  readonly message: boolean;
}

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const AMOUNT_PATTERN = /^\d+$/;

const REQUIRED_MESSAGE = "Campo obligatorio.";
const PERIOD_FORMAT_MESSAGE = "Usá el formato AAAA-MM, por ejemplo 2026-01.";
const AMOUNT_FORMAT_MESSAGE = "Ingresá solo dígitos, sin puntos ni símbolos.";

export function SmeRequestForm({
  simuladoLabel,
  onSubmit,
  submitError,
  isSubmitting = false
}: SmeRequestFormProps) {
  const {
    control,
    handleSubmit,
    formState: { errors }
  } = useForm<SmeRequestFormValues>({
    defaultValues: { declaredTotalArs: "", periodStart: "", periodEnd: "" }
  });

  // Server errors are dismissed per field when the user edits it. Dismissals
  // belong to one `submitError` object: a new error from the caller starts
  // fresh, so a stale dismissal can never mask it.
  const [dismissal, setDismissal] = useState<Dismissal>({ forError: submitError, fields: [], message: false });
  const active: Dismissal =
    dismissal.forError === submitError ? dismissal : { forError: submitError, fields: [], message: false };

  const dismiss = (name: SmeRequestFormField) =>
    setDismissal({
      forError: submitError,
      fields: active.fields.includes(name) ? active.fields : [...active.fields, name],
      message: true
    });

  // A live server error wins over local validation state, never the reverse.
  const errorFor = (field: SmeRequestFormField): string | undefined =>
    (active.fields.includes(field) ? undefined : submitError?.fieldErrors?.[field]) ??
    errors[field]?.message;

  const field = (
    name: SmeRequestFormField,
    label: string,
    hint: string,
    rules: Pick<RegisterOptions, "required" | "pattern">,
    inputMode: "numeric" | "text"
  ) => {
    const error = errorFor(name);
    return (
      <Controller
        name={name}
        control={control}
        rules={rules}
        render={({ field: rhfField }) => (
          <TextField
            label={label}
            helperText={hint}
            {...(error ? { error } : {})}
            isRequired
            inputMode={inputMode}
            value={rhfField.value}
            onChange={(value) => {
              rhfField.onChange(value);
              dismiss(name);
            }}
          />
        )}
      />
    );
  };

  return (
    <form
      lang="es"
      noValidate
      aria-label="Solicitud de financiamiento"
      className="flex max-w-md flex-col gap-4"
      onSubmit={handleSubmit((values) => onSubmit(values))}
    >
      <div className="flex items-center gap-2">
        <span>Datos de la solicitud</span>
        <Badge variant="simulado" label={simuladoLabel} lang="es" />
      </div>

      {field(
        "declaredTotalArs",
        "Total declarado (ARS)",
        "Ventas totales declaradas para el rango, en pesos enteros.",
        {
          required: REQUIRED_MESSAGE,
          pattern: { value: AMOUNT_PATTERN, message: AMOUNT_FORMAT_MESSAGE }
        },
        "numeric"
      )}
      {field(
        "periodStart",
        "Período desde",
        "Formato AAAA-MM.",
        {
          required: REQUIRED_MESSAGE,
          pattern: { value: PERIOD_PATTERN, message: PERIOD_FORMAT_MESSAGE }
        },
        "text"
      )}
      {field(
        "periodEnd",
        "Período hasta",
        "Formato AAAA-MM.",
        {
          required: REQUIRED_MESSAGE,
          pattern: { value: PERIOD_PATTERN, message: PERIOD_FORMAT_MESSAGE }
        },
        "text"
      )}

      {submitError?.message && !active.message ? (
        <p role="alert" className="text-sm text-trust-critical">
          {submitError.message}
        </p>
      ) : null}

      <Button type="submit" isDisabled={isSubmitting}>
        {isSubmitting ? "Enviando…" : "Enviar solicitud"}
      </Button>
    </form>
  );
}
