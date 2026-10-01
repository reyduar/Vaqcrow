"use client";

import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import type { Key } from "react";
import { useId } from "react";
import { IoCheckmarkOutline } from "react-icons/io5";

/**
 * ChipToggleGroup primitive (Issue #306 / T2). Wraps HeroUI's
 * `ToggleButtonGroup`/`ToggleButton` (react-aria-components underneath) as
 * multi-select pill chips (`isDetached`, matching the template's
 * pill-shaped, gapped sector/risk filters rather than a connected segmented
 * control). React Aria's `ToggleButton` already sets `aria-pressed` on the
 * underlying `<button>` — no manual wiring needed there. Selected state is
 * never colour-only: a selected chip also renders a visible, `aria-hidden`
 * checkmark icon next to its label (the label text itself is the accessible
 * content, so the icon only needs to be perceivable, not announced twice).
 */
export interface ChipToggleGroupOption {
  readonly value: string;
  readonly label: string;
}

export interface ChipToggleGroupProps {
  readonly label: string;
  readonly options: readonly ChipToggleGroupOption[];
  readonly value?: readonly string[];
  readonly defaultValue?: readonly string[];
  readonly onChange?: (value: readonly string[]) => void;
  readonly isDisabled?: boolean;
  readonly className?: string;
}

export function ChipToggleGroup({
  label,
  options,
  value,
  defaultValue,
  onChange,
  isDisabled = false,
  className
}: ChipToggleGroupProps) {
  const labelId = useId();

  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-sm font-medium">
        {label}
      </span>
      <ToggleButtonGroup
        aria-labelledby={labelId}
        selectionMode="multiple"
        isDetached
        isDisabled={isDisabled}
        {...(className ? { className } : {})}
        {...(value ? { selectedKeys: value } : {})}
        {...(defaultValue ? { defaultSelectedKeys: defaultValue } : {})}
        {...(onChange ? { onSelectionChange: (keys: Iterable<Key>) => onChange(Array.from(keys, String)) } : {})}
      >
        {options.map((option) => (
          <ToggleButton key={option.value} id={option.value} className="rounded-pill">
            {({ isSelected }) => (
              <>
                {isSelected ? <IoCheckmarkOutline aria-hidden="true" focusable="false" /> : null}
                {option.label}
              </>
            )}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}
