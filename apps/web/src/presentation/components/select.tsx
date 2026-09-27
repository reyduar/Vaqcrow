"use client";

import { Description, FieldError, Label, ListBox, Select as HeroSelect } from "@heroui/react";
import type { Key } from "react";

/**
 * Select primitive (Issue #306 / T2). Wraps HeroUI's `Select` compound
 * (`Select.Trigger`/`Select.Value`/`Select.Indicator`/`Select.Popover` +
 * `ListBox`, itself `react-aria-components`) for fixed-option pickers, e.g.
 * a province. Follows the same label/helper/error shape as `TextField`
 * (the helper stays visible next to the error) so a caller can swap between the two
 * primitives without relearning the pattern.
 */
export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectProps {
  readonly label: string;
  readonly options: readonly SelectOption[];
  readonly placeholder?: string;
  readonly name?: string;
  readonly value?: string | null;
  readonly defaultValue?: string;
  readonly onChange?: (value: string | null) => void;
  readonly helperText?: string;
  readonly error?: string;
  readonly isRequired?: boolean;
  readonly isDisabled?: boolean;
  readonly fullWidth?: boolean;
  readonly className?: string;
}

export function Select({
  label,
  options,
  placeholder,
  name,
  value,
  defaultValue,
  onChange,
  helperText,
  error,
  isRequired = false,
  isDisabled = false,
  fullWidth = false,
  className
}: SelectProps) {
  const isInvalid = Boolean(error);

  return (
    <HeroSelect
      isRequired={isRequired}
      isInvalid={isInvalid}
      isDisabled={isDisabled}
      fullWidth={fullWidth}
      {...(placeholder ? { placeholder } : {})}
      {...(name ? { name } : {})}
      {...(className ? { className } : {})}
      {...(value !== undefined ? { value } : {})}
      {...(defaultValue !== undefined ? { defaultValue } : {})}
      {...(onChange ? { onChange: (key: Key | Key[] | null) => onChange(key === null ? null : String(key)) } : {})}
    >
      <Label>{label}</Label>
      <HeroSelect.Trigger>
        <HeroSelect.Value />
        <HeroSelect.Indicator />
      </HeroSelect.Trigger>
      <HeroSelect.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </HeroSelect.Popover>
      {helperText ? <Description>{helperText}</Description> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </HeroSelect>
  );
}
