"use client";

import { Label, Slider as HeroSlider } from "@heroui/react";

/**
 * Slider primitive (Issue #306 / T2). Wraps HeroUI's `Slider` compound
 * (`Slider.Output`/`Slider.Track`/`Slider.Fill`/`Slider.Thumb`, itself
 * `react-aria-components`) for the template's goal-amount/close-date range
 * inputs. Values stay numeric (e.g. a day count, or an XLM amount); the
 * caller-supplied `formatValue` renders the visible/announced text (e.g.
 * "30 XLM" or a formatted date), since HeroUI's own `formatOptions` is
 * `Intl.NumberFormatOptions`-only and can't express a unit like "XLM".
 * Range mode (two thumbs) is the `value`/`defaultValue: [number, number]`
 * shape HeroUI already supports natively — each thumb gets its own
 * `aria-label` (`rangeThumbLabels`) since a single `<Label>` can only name
 * one control.
 */
export type SliderValue = number | readonly [number, number];

export interface SliderProps {
  readonly label: string;
  readonly value?: SliderValue;
  readonly defaultValue?: SliderValue;
  readonly onChange?: (value: SliderValue) => void;
  readonly onChangeEnd?: (value: SliderValue) => void;
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly step?: number;
  /** Formats a single numeric value for the visible output and thumb labels. */
  readonly formatValue?: (value: number) => string;
  /** Accessible label suffixes for the two thumbs of a range value. */
  readonly rangeThumbLabels?: readonly [string, string];
  readonly isDisabled?: boolean;
  readonly className?: string;
}

const DEFAULT_FORMAT = (value: number) => String(value);
const DEFAULT_RANGE_LABELS: readonly [string, string] = ["mínimo", "máximo"];

export function Slider({
  label,
  value,
  defaultValue,
  onChange,
  onChangeEnd,
  minValue,
  maxValue,
  step,
  formatValue = DEFAULT_FORMAT,
  rangeThumbLabels = DEFAULT_RANGE_LABELS,
  isDisabled = false,
  className
}: SliderProps) {
  return (
    <HeroSlider
      isDisabled={isDisabled}
      {...(minValue !== undefined ? { minValue } : {})}
      {...(maxValue !== undefined ? { maxValue } : {})}
      {...(step !== undefined ? { step } : {})}
      {...(className ? { className } : {})}
      {...(value !== undefined ? { value: value as number | number[] } : {})}
      {...(defaultValue !== undefined ? { defaultValue: defaultValue as number | number[] } : {})}
      {...(onChange ? { onChange: onChange as (value: number | number[]) => void } : {})}
      {...(onChangeEnd ? { onChangeEnd: onChangeEnd as (value: number | number[]) => void } : {})}
    >
      <Label>{label}</Label>
      <HeroSlider.Output>{({ state }) => state.values.map(formatValue).join(" – ")}</HeroSlider.Output>
      <HeroSlider.Track>
        {({ state }) => (
          <>
            <HeroSlider.Fill />
            {state.values.map((_, index) => (
              <HeroSlider.Thumb
                key={index}
                index={index}
                {...(state.values.length > 1
                  ? { "aria-label": `${label} (${rangeThumbLabels[index] ?? DEFAULT_RANGE_LABELS[index]})` }
                  : {})}
              />
            ))}
          </>
        )}
      </HeroSlider.Track>
    </HeroSlider>
  );
}
