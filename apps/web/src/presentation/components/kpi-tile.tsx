import type { IconType } from "react-icons";
import { Badge } from "./badge";

/**
 * KpiTile (Issue #314 / T1): a labelled stat tile — the "Compuestos" KPI
 * cards from `Vaqcrow Informes.dc.html` / `Vaqcrow Portafolio.dc.html`
 * (`docs/design/template/`, git-ignored). Presentational only: `value` and
 * `note` are already-formatted strings, never numbers this component
 * formats or computes itself.
 *
 * Rendered as a single `<dl>` with one `<dt>` (the label) and one or two
 * `<dd>` elements (the value, and the optional note) so the label and value
 * stay associated for assistive tech without a separate `aria-label`/`id`
 * wiring — the same "labelled group via native semantics" approach
 * `DistributionCalculation` (#310/T2) took with `<table>`/`<caption>`.
 */
export interface KpiTileProps {
  readonly label: string;
  /** Already formatted by the caller, e.g. "ARS 9.450.000" or "38". */
  readonly value: string;
  /** Already formatted by the caller, e.g. "de ARS 15.000.000". */
  readonly note?: string;
  /** Decorative only — react-icons/io5 icon, always rendered aria-hidden. */
  readonly icon?: IconType;
  /**
   * Renders a SIMULADO badge contiguous to the value when set — reusing the
   * `Badge`/`SyntheticValue` (Feature #17) pattern. Sourced by the caller
   * from the fixture record itself; never hardcoded here.
   */
  readonly simuladoLabel?: string;
  readonly className?: string;
}

export function KpiTile({ label, value, note, icon: Icon, simuladoLabel, className }: KpiTileProps) {
  return (
    <dl
      className={`m-0 flex flex-col gap-2 rounded-2xl border border-border p-[18px] ${className ?? ""}`.trim()}
    >
      <div className="flex items-center justify-between gap-2">
        <dt className="text-sm font-medium text-muted">{label}</dt>
        {Icon ? <Icon aria-hidden="true" focusable="false" className="h-5 w-5 text-muted" /> : null}
      </div>
      <dd className="m-0 flex items-baseline gap-2">
        <span className="text-2xl leading-tight font-bold tracking-tight tabular-nums">{value}</span>
        {simuladoLabel ? <Badge variant="simulado" label={simuladoLabel} lang="es" /> : null}
      </dd>
      {note ? <dd className="m-0 text-sm text-muted">{note}</dd> : null}
    </dl>
  );
}
