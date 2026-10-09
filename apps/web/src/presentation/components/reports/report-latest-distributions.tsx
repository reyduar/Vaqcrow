import { toDistributionRows } from "@/application/reports/distributions";
import type { ReportLatestDistribution } from "@/application/ports/report-port";
import { Badge } from "../badge";

/**
 * "Últimas distribuciones" (`Vaqcrow Informes.dc.html`, Feature #430, WU2).
 * Presentational: every cell is already formatted. The state is a `Badge` with
 * a tone *and* a visible label, so meaning never lives in colour alone. A
 * missing declared sale or share renders "Sin dato"/"Sin distribución", never a
 * zero.
 */
export interface ReportLatestDistributionsProps {
  readonly distributions: readonly ReportLatestDistribution[];
  readonly className?: string;
}

const CELL = "border-b border-border py-[14px] pr-4";

export function ReportLatestDistributions({ distributions, className }: ReportLatestDistributionsProps) {
  const rows = toDistributionRows(distributions);

  return (
    <section
      aria-labelledby="report-distributions-heading"
      className={`flex flex-col gap-3 overflow-x-auto rounded-card border border-border p-6 ${className ?? ""}`.trim()}
    >
      <h2 id="report-distributions-heading" className="m-0 text-[19px] font-bold">
        Últimas distribuciones
      </h2>
      {rows.length === 0 ? (
        <p className="m-0 text-sm text-text-secondary">Sin distribuciones en el período.</p>
      ) : (
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className={`${CELL} text-left text-xs font-semibold text-text-secondary`}>Fecha</th>
              <th scope="col" className={`${CELL} text-left text-xs font-semibold text-text-secondary`}>PyME</th>
              <th scope="col" className={`${CELL} text-right text-xs font-semibold text-text-secondary`}>
                Ventas declaradas · SIMULADO
              </th>
              <th scope="col" className={`${CELL} text-right text-xs font-semibold text-text-secondary`}>
                Tu participación
              </th>
              <th scope="col" className={`${CELL} text-right text-xs font-semibold text-text-secondary`}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.date}-${row.pyme}-${index}`}>
                <td className={`${CELL} whitespace-nowrap`}>{row.date}</td>
                <th scope="row" className={`${CELL} text-left font-[650]`}>
                  {row.pyme}
                </th>
                <td className={`${CELL} whitespace-nowrap text-right`}>{row.sales}</td>
                <td className={`${CELL} whitespace-nowrap text-right font-[650]`}>{row.share}</td>
                <td className={`${CELL} text-right`}>
                  <Badge variant="transaction" tone={row.tone} label={row.state} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="m-0 text-xs text-text-secondary">
        Cálculo determinístico; la IA no calcula esta obligación. Un hash de Testnet demuestra ejecución técnica, no una
        inversión real.
      </p>
    </section>
  );
}
