import { microcopy } from "@/application/trust/disclosures";

/**
 * DistributionCalculation (Issue #310 / T2): the deterministic
 * distribution-calculation block from the template (`Vaqcrow
 * Sistema.dc.html`, "Cálculo de distribución · agosto"). Every number is a
 * prop already computed and formatted by the caller — `inputs`, `rounding`
 * and `total` are strings, not numbers, so this component performs no
 * arithmetic and applies no currency/percentage formatting itself.
 *
 * Rendered as an HTML `<table>` with a `<caption>` so the heading is the
 * table's accessible name natively, rather than a `<dl>` (which has no
 * built-in caption mechanism). `microcopy.deterministicCalculation` sits
 * directly under the table, exactly as the template places it, and no
 * `Badge`/AI styling hook is used anywhere in this component — it must read
 * as distinct from `AiAssessmentPanel`, never as another AI panel.
 */
export interface DistributionCalculationRow {
  readonly label: string;
  readonly value: string;
}

export interface DistributionCalculationProps {
  /** e.g. "Cálculo de distribución · agosto". */
  readonly heading: string;
  /** e.g. "regla rs-v1.2"; shown next to the heading. */
  readonly ruleId: string;
  /** Ordered input rows, e.g. declared sales, participation rate. */
  readonly inputs: readonly DistributionCalculationRow[];
  /** e.g. "2 decimales, al par". */
  readonly rounding: string;
  readonly total: DistributionCalculationRow;
  readonly className?: string;
}

export function DistributionCalculation({
  heading,
  ruleId,
  inputs,
  rounding,
  total,
  className
}: DistributionCalculationProps) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`.trim()}>
      <table className="w-full border-collapse text-sm">
        <caption className="mb-2 flex flex-wrap items-center justify-between gap-2 text-left">
          <span className="font-semibold">{heading}</span>
          <span className="font-mono text-xs text-muted">{ruleId}</span>
        </caption>
        <tbody>
          {inputs.map((row) => (
            <tr key={row.label} className="border-b border-border">
              <th scope="row" className="py-2 text-left font-normal text-muted">
                {row.label}
              </th>
              <td className="py-2 text-right">{row.value}</td>
            </tr>
          ))}
          <tr className="border-b border-border">
            <th scope="row" className="py-2 text-left font-normal text-muted">
              Redondeo
            </th>
            <td className="py-2 text-right">{rounding}</td>
          </tr>
          <tr>
            <th scope="row" className="py-2 text-left text-base font-semibold">
              {total.label}
            </th>
            <td className="py-2 text-right text-lg font-bold">{total.value}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-xs text-muted">{microcopy.deterministicCalculation}</p>
    </div>
  );
}
