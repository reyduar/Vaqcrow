"use client";

import { useState } from "react";
import type { AvailableRange } from "@/application/ports/report-port";
import { isWithinAvailable, parseMonthInput, type PeriodPreset } from "@/application/reports/periods";

/**
 * The period selector of `Vaqcrow Informes.dc.html` (Feature #430, WU2): the
 * three presets built from the investor's own data plus a custom `desde`/`hasta`
 * month range constrained to `availableRange`.
 *
 * Owner-pending copy: the "Personalizado"/"Desde"/"Hasta" labels and the
 * invalid-range message — the template only designs the three-option select,
 * so these are neutral, honest additions pending the owner's wording.
 *
 * An incomplete or out-of-range pair is rejected locally with a visible message
 * and never reaches the API (which would answer `400 invalid_request`).
 */
export interface ReportPeriodSelectorProps {
  readonly presets: readonly PeriodPreset[];
  readonly selectedPresetId: PeriodPreset["id"] | null;
  readonly available: AvailableRange;
  readonly onSelectPreset: (id: PeriodPreset["id"]) => void;
  readonly onCustomRange: (from: string, to: string) => void;
}

const INVALID_RANGE_MESSAGE = "Elegí un rango dentro de tus períodos con datos.";

const FIELD_CLASS =
  "h-11 rounded-control border border-control bg-canvas px-2.5 text-sm font-semibold text-text-primary";

function capitalize(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function ReportPeriodSelector({
  presets,
  selectedPresetId,
  available,
  onSelectPreset,
  onCustomRange
}: ReportPeriodSelectorProps) {
  const [customFrom, setCustomFrom] = useState(available.firstPeriod ?? "");
  const [customTo, setCustomTo] = useState(available.lastPeriod ?? "");
  const [invalid, setInvalid] = useState(false);

  function apply(nextFrom: string, nextTo: string) {
    const from = parseMonthInput(nextFrom);
    const to = parseMonthInput(nextTo);
    if (
      from === null ||
      to === null ||
      !isWithinAvailable(from, available) ||
      !isWithinAvailable(to, available) ||
      from > to
    ) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onCustomRange(from, to);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-end justify-end gap-2">
        <label htmlFor="report-period" className="flex items-center gap-2 text-sm text-text-secondary">
          Período
          <select
            id="report-period"
            value={selectedPresetId ?? "custom"}
            onChange={(event) => {
              const value = event.target.value;
              if (value !== "custom") onSelectPreset(value as PeriodPreset["id"]);
            }}
            className={FIELD_CLASS}
          >
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {capitalize(preset.label)}
              </option>
            ))}
            <option value="custom">Personalizado</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-text-secondary">
          Desde
          <input
            type="month"
            value={customFrom}
            {...(available.firstPeriod ? { min: available.firstPeriod } : {})}
            {...(available.lastPeriod ? { max: available.lastPeriod } : {})}
            onChange={(event) => {
              setCustomFrom(event.target.value);
              apply(event.target.value, customTo);
            }}
            className={FIELD_CLASS}
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-text-secondary">
          Hasta
          <input
            type="month"
            value={customTo}
            {...(available.firstPeriod ? { min: available.firstPeriod } : {})}
            {...(available.lastPeriod ? { max: available.lastPeriod } : {})}
            onChange={(event) => {
              setCustomTo(event.target.value);
              apply(customFrom, event.target.value);
            }}
            className={FIELD_CLASS}
          />
        </label>
      </div>
      {invalid ? (
        <span role="alert" className="text-xs text-trust-caution">
          {INVALID_RANGE_MESSAGE}
        </span>
      ) : null}
    </div>
  );
}
