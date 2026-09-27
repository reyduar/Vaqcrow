"use client";

import { Description, FieldError, Label, TextArea as HeroTextArea, TextField as HeroTextField } from "@heroui/react";

/**
 * TextArea primitive (Issue #306 / T1). Wraps HeroUI's `TextField` compound
 * with `TextArea` instead of `Input`, so multiline fields (e.g. a required
 * decision reason) share the same label/helper/error shape as `TextField`:
 * a visible error linked via `aria-describedby`, never only `aria-invalid`.
 */
export interface TextAreaProps {
  readonly label: string;
  readonly name?: string;
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onChange?: (value: string) => void;
  readonly helperText?: string;
  readonly error?: string;
  readonly isRequired?: boolean;
  readonly rows?: number;
  readonly maxLength?: number;
  readonly fullWidth?: boolean;
  readonly className?: string;
}

export function TextArea({
  label,
  name,
  value,
  defaultValue,
  onChange,
  helperText,
  error,
  isRequired = false,
  rows = 4,
  maxLength,
  fullWidth = false,
  className
}: TextAreaProps) {
  const isInvalid = Boolean(error);

  return (
    <HeroTextField
      isRequired={isRequired}
      isInvalid={isInvalid}
      fullWidth={fullWidth}
      {...(className ? { className } : {})}
    >
      <Label>{label}</Label>
      <HeroTextArea
        name={name}
        value={value}
        defaultValue={defaultValue}
        rows={rows}
        maxLength={maxLength}
        fullWidth={fullWidth}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      />
      {error ? <FieldError>{error}</FieldError> : helperText ? <Description>{helperText}</Description> : null}
    </HeroTextField>
  );
}
