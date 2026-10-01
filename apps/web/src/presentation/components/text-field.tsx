"use client";

import { Description, FieldError, Input, InputGroup, Label, TextField as HeroTextField } from "@heroui/react";
import { useId } from "react";
import { Badge } from "./badge";

/**
 * TextField primitive (Issue #306 / T1). Wraps HeroUI's `TextField` compound
 * (`Label`/`Input`/`Description`/`FieldError`) so every text field in the app
 * shares one accessible shape: a visible error linked via
 * `aria-describedby` (never only `aria-invalid`), an optional unit suffix
 * that is visible and announced (not only decorative), and a read-only mode
 * that can show the SIMULADO tag contiguous to the value — reusing `Badge`
 * (see `badge.tsx`/`synthetic-value.tsx`) rather than re-inventing the tag.
 */
export type TextFieldInputType = "text" | "email" | "password" | "number" | "tel" | "url" | "date";

export interface TextFieldProps {
  readonly label: string;
  readonly name?: string;
  readonly type?: TextFieldInputType;
  readonly inputMode?: "text" | "numeric" | "decimal" | "tel" | "email" | "url" | "search" | "none";
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onChange?: (value: string) => void;
  readonly helperText?: string;
  readonly error?: string;
  readonly isRequired?: boolean;
  readonly isReadOnly?: boolean;
  /** Visible, announced unit suffix, e.g. "XLM" or "%". */
  readonly unit?: string;
  /** When set with isReadOnly, renders the SIMULADO tag contiguous to the value. */
  readonly simuladoLabel?: string;
  readonly autoComplete?: string;
  readonly maxLength?: number;
  readonly fullWidth?: boolean;
  readonly className?: string;
}

export function TextField({
  label,
  name,
  type = "text",
  inputMode,
  value,
  defaultValue,
  onChange,
  helperText,
  error,
  isRequired = false,
  isReadOnly = false,
  unit,
  simuladoLabel,
  autoComplete,
  maxLength,
  fullWidth = false,
  className
}: TextFieldProps) {
  const unitId = useId();
  const isInvalid = Boolean(error);
  const hasSuffix = Boolean(unit) || Boolean(simuladoLabel);
  const suffixDescribedBy = hasSuffix ? unitId : undefined;

  const inputProps = {
    name,
    type,
    inputMode,
    value,
    defaultValue,
    readOnly: isReadOnly,
    autoComplete,
    maxLength,
    "aria-describedby": suffixDescribedBy,
    onChange: onChange ? (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value) : undefined
  };

  return (
    <HeroTextField
      isRequired={isRequired}
      isInvalid={isInvalid}
      isReadOnly={isReadOnly}
      fullWidth={fullWidth}
      {...(className ? { className } : {})}
    >
      {/* Field shell from `Vaqcrow Sistema.dc.html` §04 "Campos" (lines 220–238):
          14 px / 600 label, a 44 px control at the control radius with the
          `--control` border, and 12 px secondary helper/error text. */}
      <Label className="text-sm font-semibold text-text-primary">{label}</Label>
      {hasSuffix ? (
        <InputGroup fullWidth={fullWidth} className="h-11 rounded-control border-control bg-canvas">
          <InputGroup.Input {...inputProps} className="h-11 rounded-control border-control bg-canvas" />
          <InputGroup.Suffix id={unitId} className="gap-2 text-text-secondary">
            {unit ? <span>{unit}</span> : null}
            {simuladoLabel ? <Badge variant="simulado" label={simuladoLabel} lang="es" /> : null}
          </InputGroup.Suffix>
        </InputGroup>
      ) : (
        <Input
          {...inputProps}
          fullWidth={fullWidth}
          className="h-11 rounded-control border-control bg-canvas"
        />
      )}
      {/* The helper carries format instructions, which matter most while the
          field is in error, so it stays next to the error instead of yielding. */}
      {helperText ? <Description className="text-xs text-text-secondary">{helperText}</Description> : null}
      {error ? (
        // HeroUI's `FieldError` (like `Button`) filters "role" out of the DOM
        // props it forwards to react-aria-components' own `FieldError`, whose
        // `filterDOMProps({ global: true })` call has no `role` in its
        // allowlist — the same gap T1 hit for Button's `aria-busy`. There is
        // no `render` escape hatch here, so the alert role is set on a plain
        // wrapping element instead; the id `FieldError` generates (and that
        // the input's `aria-describedby` points at) stays on the inner node.
        <span role="alert">
          <FieldError className="text-xs text-trust-critical">{error}</FieldError>
        </span>
      ) : null}
    </HeroTextField>
  );
}
