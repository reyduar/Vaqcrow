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
export type TextFieldInputType = "text" | "email" | "password" | "number" | "tel" | "url";

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
      <Label>{label}</Label>
      {hasSuffix ? (
        <InputGroup fullWidth={fullWidth}>
          <InputGroup.Input {...inputProps} />
          <InputGroup.Suffix id={unitId} className="gap-2">
            {unit ? <span>{unit}</span> : null}
            {simuladoLabel ? <Badge variant="simulado" label={simuladoLabel} lang="es" /> : null}
          </InputGroup.Suffix>
        </InputGroup>
      ) : (
        <Input {...inputProps} fullWidth={fullWidth} />
      )}
      {error ? <FieldError>{error}</FieldError> : helperText ? <Description>{helperText}</Description> : null}
    </HeroTextField>
  );
}
