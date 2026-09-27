/**
 * BarChart (Issue #314 / T2): the "Ventas mensuales" chart from `Vaqcrow
 * Sistema.dc.html` (`docs/design/template/`, git-ignored) — a monthly bar
 * series with an accessible table fallback inside `<details>`. Presentational
 * only: every number (`value`) only decides bar height, and every visible
 * string (`displayValue`, `caption`, `notice`) is already formatted by the
 * caller; this component performs no currency or percentage formatting.
 *
 * Dataviz-skill decisions (Datos/BarChart, single series):
 * - No legend: a single series' identity is already named by `title`, per
 *   the skill's own rule ("a single series needs no legend box").
 * - Colour is never the only signal for `missing`/`anomalous`: both render a
 *   visible, non-colour text marker ("Sin dato"/"Atípico") in the decorative
 *   visual AND in the accessible table's Estado column, matching the skill's
 *   "status colors ship with icon + label, never color alone" rule.
 * - Reused the project's own `--color-chart-*` tokens (`globals.css`,
 *   Feature #17) unchanged rather than introducing a new palette, per this
 *   task's explicit instruction. `--color-chart-primary`/`--color-chart-anomaly`
 *   were re-validated with the skill's `validate_palette.js` as a categorical
 *   pair: light mode passes every check cleanly; `--color-chart-missing` is a
 *   low-chroma neutral (an absence marker, not a categorical hue) and was
 *   checked as a lone status colour instead — its ~2.5:1 contrast against the
 *   canvas is too low for text, so it is only ever used for the placeholder's
 *   decorative dashed border/background, never for the "Sin dato" text itself
 *   (`text-muted` is used there, matching the rest of the codebase). The dark
 *   pastel pair (`#a9ccff`/`#ffb3ae`) fails the validator's categorical
 *   lightness/chroma bands (both read as very light, low-chroma pastels) but
 *   passes CVD separation, the normal-vision floor and surface contrast; it
 *   is a pre-existing Feature #17 token pair kept unchanged, and the
 *   non-colour "Atípico" text marker is the required secondary encoding for
 *   the borderline case either way.
 */
export type BarChartPointStatus = "reported" | "missing" | "anomalous";

export interface BarChartPoint {
  readonly label: string;
  /** Bar height input; `null` only when `status === "missing"` — never 0. */
  readonly value: number | null;
  /** Already formatted by the caller for the accessible table cell. */
  readonly displayValue: string;
  /** Defaults to "reported" when omitted. */
  readonly status?: BarChartPointStatus;
}

const HEADING_TAGS = ["h2", "h3", "h4", "h5", "h6"] as const;
type HeadingTag = (typeof HEADING_TAGS)[number];

export interface BarChartProps {
  readonly title: string;
  /** Already formatted by the caller, e.g. "Enero – agosto 2026 · ARS". */
  readonly caption?: string;
  readonly series: readonly BarChartPoint[];
  readonly tableCaption: string;
  readonly valueColumnLabel?: string;
  /** Heading level for `title`; defaults to 3, matching `CampaignCard`. */
  readonly headingLevel?: 2 | 3 | 4 | 5 | 6;
  /**
   * Caller-supplied synthetic-series notice (e.g. the canonical
   * `microcopy.salesSynthetic` text). Never hardcoded here — omit to render
   * no notice.
   */
  readonly notice?: string;
  readonly className?: string;
}

const STATUS_LABEL: Readonly<Record<BarChartPointStatus, string>> = {
  reported: "Declarado",
  missing: "Sin dato",
  anomalous: "Atípico"
};

function maxValue(series: readonly BarChartPoint[]): number {
  const values = series
    .map((point) => point.value)
    .filter((value): value is number => value !== null);
  return values.length > 0 ? Math.max(...values) : 0;
}

function heightPercent(value: number, max: number): number {
  if (max <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (value / max) * 100));
}

export function BarChart({
  title,
  caption,
  series,
  tableCaption,
  valueColumnLabel = "Valor",
  headingLevel = 3,
  notice,
  className
}: BarChartProps) {
  const HeadingTag: HeadingTag = HEADING_TAGS[headingLevel - 2] ?? "h3";
  const max = maxValue(series);

  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`.trim()}>
      <div>
        <HeadingTag className="m-0 text-lg leading-tight font-bold">{title}</HeadingTag>
        {caption ? <p className="m-0 mt-0.5 text-sm text-muted">{caption}</p> : null}
      </div>

      <div
        data-part="chart-visual"
        aria-hidden="true"
        className="flex h-40 items-end gap-2 border-b border-chart-grid pb-1"
      >
        {series.map((point, index) => {
          const status = point.status ?? "reported";
          return (
            <div
              key={`${point.label}-${index}`}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            >
              {status === "anomalous" ? (
                <span className="text-[10px] font-semibold text-chart-anomaly">Atípico</span>
              ) : null}
              {status === "missing" ? (
                <div className="flex h-6 w-full items-center justify-center rounded border border-dashed border-chart-missing px-1 text-center text-[9px] text-muted">
                  Sin dato
                </div>
              ) : (
                <div
                  data-part="bar"
                  style={{ height: `${heightPercent(point.value ?? 0, max)}%` }}
                  className={`w-full rounded-t-[4px] transition-[height] duration-500 ease-out motion-reduce:transition-none ${
                    status === "anomalous" ? "bg-chart-anomaly" : "bg-chart-primary"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div aria-hidden="true" className="flex gap-2 text-center text-[11px] text-muted">
        {series.map((point, index) => (
          <span key={`${point.label}-${index}`} className="flex-1 break-words">
            {point.label}
          </span>
        ))}
      </div>

      {notice ? <p className="m-0 text-sm text-muted">{notice}</p> : null}

      <details className="border-t border-border pt-3">
        <summary className="cursor-pointer text-sm font-semibold">Ver tabla accesible</summary>
        <table className="mt-2 w-full border-collapse text-sm">
          <caption className="mb-2 text-left text-sm font-semibold">{tableCaption}</caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-border py-2 text-left text-xs font-semibold text-muted">
                Período
              </th>
              <th scope="col" className="border-b border-border py-2 text-right text-xs font-semibold text-muted">
                {valueColumnLabel}
              </th>
              <th scope="col" className="border-b border-border py-2 text-right text-xs font-semibold text-muted">
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {series.map((point, index) => {
              const status = point.status ?? "reported";
              return (
                <tr key={`${point.label}-${index}`}>
                  <th scope="row" className="border-b border-border py-2 text-left font-medium">
                    {point.label}
                  </th>
                  <td className="border-b border-border py-2 text-right font-semibold">{point.displayValue}</td>
                  <td className="border-b border-border py-2 text-right">{STATUS_LABEL[status]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </div>
  );
}
