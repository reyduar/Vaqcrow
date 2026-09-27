"use client";

import { Label, ProgressBar as HeroProgressBar } from "@heroui/react";

/**
 * ProgressBar primitive (Issue #310 / T1). Wraps HeroUI's `ProgressBar`
 * (itself `react-aria-components`, which already exposes `role="progressbar"`
 * plus `aria-valuenow`/`aria-valuemin`/`aria-valuemax`) for the funding
 * progress bar the template shows on every campaign card. `formatValue`
 * mirrors `Slider`'s T2 design decision: HeroUI's own `formatOptions` is
 * `Intl.NumberFormatOptions`-only and cannot express "ARS 630.000 de
 * 1.000.000" or an XLM amount, so the caller supplies the visible text. It is
 * forwarded as react-aria's own `valueLabel` prop, not a plain
 * `aria-valuetext` override — `useProgressBar` always recomputes
 * `aria-valuetext` from `formatOptions` and merges it in last, silently
 * overwriting a directly-passed `aria-valuetext` (confirmed empirically, not
 * guessed, by reading `react-aria/dist/private/progress/useProgressBar.mjs`:
 * it only skips its own formatter when `valueLabel` is already truthy). No
 * currency or unit maths happens in here. `value`/`goal` are never mutated: an
 * overfunded campaign (`value > goal`) still reports its real numbers via
 * `formatValue`, only the visual fill is clamped to 100% (react-aria's own
 * `ProgressBarState` clamps the internal percentage to the min/max range).
 */
export interface ProgressBarProps {
  readonly label: string;
  readonly value: number;
  readonly goal: number;
  readonly minValue?: number;
  /** Visible text and aria-valuetext; default renders plain numbers. */
  readonly formatValue?: (value: number, goal: number) => string;
  /**
   * Only set by the caller once the goal is explicitly confirmed reached —
   * never inferred here from `value >= goal` — so an in-progress campaign
   * never reads as already successful from color alone.
   */
  readonly isGoalReached?: boolean;
  readonly className?: string;
}

export function ProgressBar({
  label,
  value,
  goal,
  minValue = 0,
  formatValue,
  isGoalReached = false,
  className
}: ProgressBarProps) {
  const valueText = formatValue ? formatValue(value, goal) : `${value} de ${goal}`;

  return (
    <HeroProgressBar
      value={value}
      minValue={minValue}
      maxValue={goal}
      color={isGoalReached ? "success" : "accent"}
      valueLabel={valueText}
      {...(className ? { className } : {})}
    >
      <Label>{label}</Label>
      <HeroProgressBar.Output>{valueText}</HeroProgressBar.Output>
      <HeroProgressBar.Track>
        <HeroProgressBar.Fill />
      </HeroProgressBar.Track>
    </HeroProgressBar>
  );
}
