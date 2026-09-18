"use client";

import { Button, Input, Label } from "@heroui/react";
import { useForm } from "react-hook-form";
import type {
  SmeRequestFormField,
  SmeRequestFormValues,
  SmeRequestSubmitError
} from "@/application/evidence/review-view-model";
import { Badge } from "./badge";

/**
 * SmeRequestForm (Task #56 / T4). React Hook Form owns only browser form
 * state plus required/format hints. Business validation (totals, period
 * order, contracts) stays with the backend: values are handed to `onSubmit`
 * as raw strings and `submitError` is rendered verbatim, never interpreted.
 */
export interface SmeRequestFormProps {
  /** SIMULADO label sourced from the fixture/request record, never hardcoded here. */
  readonly simuladoLabel: string;
  readonly onSubmit: (values: SmeRequestFormValues) => void | Promise<void>;
  readonly submitError?: SmeRequestSubmitError;
  readonly isSubmitting?: boolean;
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
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<SmeRequestFormValues>({
    defaultValues: { declaredTotalArs: "", periodStart: "", periodEnd: "" }
  });

  const errorFor = (field: SmeRequestFormField): string | undefined =>
    errors[field]?.message ?? submitError?.fieldErrors?.[field];

  const field = (
    name: SmeRequestFormField,
    label: string,
    hint: string,
    rules: Parameters<typeof register>[1],
    inputMode: "numeric" | "text"
  ) => {
    const error = errorFor(name);
    const hintId = `${name}-hint`;
    const errorId = `${name}-error`;
    return (
      <div className="flex flex-col gap-1">
        <Label htmlFor={name}>{label}</Label>
        <Input
          id={name}
          type="text"
          inputMode={inputMode}
          aria-required="true"
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          {...register(name, rules)}
        />
        <span id={hintId} className="text-sm text-muted">
          {hint}
        </span>
        {error ? (
          <span id={errorId} role="alert" className="text-sm text-trust-critical">
            {error}
          </span>
        ) : null}
      </div>
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

      {submitError?.message ? (
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
