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
  /**
   * Accessible name for the `role="progressbar"` element. When omitted, the
   * visible `label` is the accessible name (react-aria associates the `<Label>`
   * child). When set, the visible row keeps its text and styling but is no
   * longer a react-aria `<Label>`, so the accessible name comes from this value
   * alone — the guide's reading-progress bar shows "Tu lectura" while carrying
   * `aria-label="Progreso de lectura"`.
   */
  readonly ariaLabel?: string;
  readonly className?: string;
}

export function ProgressBar({
  label,
  value,
  goal,
  minValue = 0,
  formatValue,
  isGoalReached = false,
  ariaLabel,
  className
}: ProgressBarProps) {
  const valueText = formatValue ? formatValue(value, goal) : `${value} de ${goal}`;
  const labelRow = "label text-sm font-medium text-text-secondary";

  return (
    <HeroProgressBar
      value={value}
      minValue={minValue}
      maxValue={goal}
      color={isGoalReached ? "success" : "accent"}
      valueLabel={valueText}
      {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
      {...(className ? { className } : {})}
    >
      {/* Track geometry from `Vaqcrow Sistema.dc.html` line 261: 6 px high,
          pill radius, `--surface` fill and an inset 1 px `--border` line.

          When `ariaLabel` drives the accessible name the visible row must NOT
          be a react-aria `<Label>`: react-aria's `useLabels` points
          `aria-labelledby` at the element itself, which overrides the bare
          `aria-label`, so the computed name would come from the visible label
          (plus the value) instead of `ariaLabel`. A plain span with identical
          classes/`data-slot` keeps the row visible without joining the name.
          Without `ariaLabel` the `<Label>` is rendered exactly as before, so
          the accessible name stays `label`. */}
      {ariaLabel ? (
        <span className={labelRow} data-slot="label">
          {label}
        </span>
      ) : (
        <Label className="text-sm font-medium text-text-secondary">{label}</Label>
      )}
      <HeroProgressBar.Output className="text-sm font-medium tabular-nums">{valueText}</HeroProgressBar.Output>
      <HeroProgressBar.Track className="h-1.5 rounded-pill bg-page-surface shadow-[inset_0_0_0_1px_var(--color-page-border)]">
        <HeroProgressBar.Fill className="rounded-pill" />
      </HeroProgressBar.Track>
    </HeroProgressBar>
  );
}
