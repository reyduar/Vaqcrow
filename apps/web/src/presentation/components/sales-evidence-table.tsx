import {
  panaderiaHorizonte,
  type SalesPeriodStatus
} from "@/application/fixtures/panaderia-horizonte";
import { Badge, type BadgeTone, type BadgeVariant } from "./badge";
import { SyntheticValue } from "./synthetic-value";

/**
 * SalesEvidenceTable (Feature #17 / Task #53): an accessible HTML table —
 * not a chart, deferred to #18 per design Decision D — rendering the
 * Panadería Horizonte SRL sales series. April renders as explicitly missing
 * (never blank, never zero); June renders with its SIMULADO/anomaly badge.
 * No cell asserts a cause for the June anomaly.
 */
const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0
});

const STATUS_LABEL: Readonly<Record<SalesPeriodStatus, string>> = {
  reported: "Declarado",
  missing: "Sin declarar",
  anomalous: "Requiere revisión"
};

const STATUS_BADGE_VARIANT: Readonly<Record<SalesPeriodStatus, BadgeVariant>> = {
  reported: "evidence",
  missing: "risk",
  anomalous: "risk"
};

const STATUS_TONE: Readonly<Record<SalesPeriodStatus, BadgeTone>> = {
  reported: "neutral",
  missing: "caution",
  anomalous: "caution"
};

export function SalesEvidenceTable() {
  return (
    <div className="overflow-x-auto">
      {/* Template table treatment (`Vaqcrow Informes.dc.html` "Últimas
          distribuciones"): a caption at the section-heading weight, a muted
          uppercase header row and a 1 px `--border` rule per row. */}
      <table lang="es" className="w-full border-collapse text-sm">
        <caption className="mb-3 text-left text-base font-bold tracking-[-0.01em]">
          Ventas mensuales sintéticas — Panadería Horizonte SRL
        </caption>
        <thead>
          <tr>
            <th scope="col" className="border-b border-border py-2 text-left text-xs font-semibold text-text-secondary">
              Período
            </th>
            <th scope="col" className="border-b border-border py-2 text-left text-xs font-semibold text-text-secondary">
              Ventas
            </th>
            <th scope="col" className="border-b border-border py-2 text-left text-xs font-semibold text-text-secondary">
              Procedencia
            </th>
            <th scope="col" className="border-b border-border py-2 text-left text-xs font-semibold text-text-secondary">
              Estado
            </th>
          </tr>
        </thead>
        <tbody>
          {panaderiaHorizonte.sales.map((period) => (
            <tr key={period.period}>
              <th scope="row" className="border-b border-border py-2.5 text-left font-medium">
                {period.label}
              </th>
              <td className="border-b border-border py-2.5">
                {period.status === "missing" ? (
                  <span>Dato faltante</span>
                ) : (
                  <SyntheticValue
                    value={currencyFormatter.format(period.amountArs ?? 0)}
                    simuladoLabel={period.simuladoLabel}
                  />
                )}
              </td>
              <td className="border-b border-border py-2.5 text-text-secondary">{period.provenance}</td>
              <td className="border-b border-border py-2.5">
                <Badge
                  variant={STATUS_BADGE_VARIANT[period.status]}
                  tone={STATUS_TONE[period.status]}
                  label={STATUS_LABEL[period.status]}
                />
                {period.note ? <p className="m-0 mt-1 text-xs text-text-secondary">{period.note}</p> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
