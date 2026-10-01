"use client";

import {
  ComboBox as HeroComboBox,
  Description,
  EmptyState,
  FieldError,
  Input,
  Label,
  ListBox
} from "@heroui/react";
import type { Key } from "react";

/**
 * ComboBox primitive (Issue #306 / T2). Wraps HeroUI's `ComboBox` compound
 * (`ComboBox.InputGroup`/`ComboBox.Trigger`/`ComboBox.Popover` + `ListBox`,
 * itself `react-aria-components`) for filterable autocomplete pickers, e.g.
 * the template's city field. `items` is a flat list of strings (each item's
 * own value and label, since a city name has no separate machine id);
 * `ListBox`'s built-in filtering (via `defaultFilter`) narrows the list as
 * the user types, and `renderEmptyState` always shows a visible "no
 * results" message instead of leaving the popover blank.
 */
export interface ComboBoxProps {
  readonly label: string;
  readonly items: readonly string[];
  readonly placeholder?: string;
  readonly name?: string;
  readonly value?: string | null;
  readonly defaultValue?: string;
  readonly onChange?: (value: string | null) => void;
  readonly emptyResultsText?: string;
  readonly helperText?: string;
  readonly error?: string;
  readonly isRequired?: boolean;
  readonly isDisabled?: boolean;
  readonly fullWidth?: boolean;
  readonly className?: string;
}

export function ComboBox({
  label,
  items,
  placeholder,
  name,
  value,
  defaultValue,
  onChange,
  emptyResultsText = "No se encontraron resultados.",
  helperText,
  error,
  isRequired = false,
  isDisabled = false,
  fullWidth = false,
  className
}: ComboBoxProps) {
  const isInvalid = Boolean(error);

  return (
    <HeroComboBox
      isRequired={isRequired}
      isInvalid={isInvalid}
      isDisabled={isDisabled}
      fullWidth={fullWidth}
      allowsEmptyCollection
      {...(name ? { name } : {})}
      {...(className ? { className } : {})}
      {...(value !== undefined ? { selectedKey: value } : {})}
      {...(defaultValue !== undefined ? { defaultSelectedKey: defaultValue } : {})}
      {...(onChange
        ? { onSelectionChange: (key: Key | null) => onChange(key === null ? null : String(key)) }
        : {})}
    >
      {/* Field shell from `Vaqcrow Sistema.dc.html` §04 "Campos". */}
      <Label className="text-sm font-semibold text-text-primary">{label}</Label>
      <HeroComboBox.InputGroup className="h-11 rounded-control border-control bg-canvas">
        <Input {...(placeholder ? { placeholder } : {})} />
        <HeroComboBox.Trigger />
      </HeroComboBox.InputGroup>
      <HeroComboBox.Popover>
        <ListBox renderEmptyState={() => <EmptyState>{emptyResultsText}</EmptyState>}>
          {items.map((item) => (
            <ListBox.Item key={item} id={item} textValue={item}>
              {item}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </HeroComboBox.Popover>
      {helperText ? <Description className="text-xs text-text-secondary">{helperText}</Description> : null}
      {error ? <FieldError className="text-xs text-trust-critical">{error}</FieldError> : null}
    </HeroComboBox>
  );
}
