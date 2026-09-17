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
    <table lang="es">
      <caption>Ventas mensuales sintéticas — Panadería Horizonte SRL</caption>
      <thead>
        <tr>
          <th scope="col">Período</th>
          <th scope="col">Ventas</th>
          <th scope="col">Procedencia</th>
          <th scope="col">Estado</th>
        </tr>
      </thead>
      <tbody>
        {panaderiaHorizonte.sales.map((period) => (
          <tr key={period.period}>
            <th scope="row">{period.label}</th>
            <td>
              {period.status === "missing" ? (
                <span>Dato faltante</span>
              ) : (
                <SyntheticValue
                  value={currencyFormatter.format(period.amountArs ?? 0)}
                  simuladoLabel={period.simuladoLabel}
                />
              )}
            </td>
            <td>{period.provenance}</td>
            <td>
              <Badge
                variant={STATUS_BADGE_VARIANT[period.status]}
                tone={STATUS_TONE[period.status]}
                label={STATUS_LABEL[period.status]}
              />
              {period.note ? <p>{period.note}</p> : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
