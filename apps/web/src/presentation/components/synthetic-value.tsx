import { Badge } from "./badge";

/**
 * SyntheticValue (Feature #17 / Task #53): wraps any synthetic datum with
 * its adjacent SIMULADO badge, so the label travels with the datum at
 * render time (demo-ui.md §9.3) instead of living only on the fixture's
 * origin screen. `simuladoLabel` is required and always sourced from the
 * fixture record itself (`SyntheticSme.simuladoLabel`, `.kyc.simuladoLabel`,
 * or `SalesPeriod.simuladoLabel`) — never hardcoded independently here.
 */
export interface SyntheticValueProps {
  readonly value: string;
  readonly simuladoLabel: string;
  /** Optional context label, e.g. "Ventas de enero"; omit inside a table cell whose column header already carries it. */
  readonly label?: string;
}

export function SyntheticValue({ value, simuladoLabel, label }: SyntheticValueProps) {
  return (
    <span className="inline-flex items-center gap-2">
      {label ? <span>{label}: </span> : null}
      <span>{value}</span>
      <Badge variant="simulado" label={simuladoLabel} lang="es" />
    </span>
  );
}
