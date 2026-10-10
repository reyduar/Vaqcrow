import { IoCalendarClearOutline } from "react-icons/io5";
import { Button } from "../button";

/**
 * The empty-period state of `Vaqcrow Informes.dc.html` (Feature #430, WU2): the
 * template's dashed panel with the icon, the "Sin datos para <período>" title,
 * the guidance line and a CTA back to the default range. Presentational.
 *
 * This state is reachable for an empty month inside the investor's range and
 * for a custom range with no activity. For an investor with no data at all the
 * same panel renders; the "Elegí un período anterior" line still points at a
 * real action (the default range) and is owner-pending for that edge.
 */
export interface ReportEmptyStateProps {
  readonly rangeLabel: string;
  readonly defaultRangeLabel: string;
  readonly onReset: () => void;
  readonly className?: string;
}

export function ReportEmptyState({ rangeLabel, defaultRangeLabel, onReset, className }: ReportEmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-start gap-3 rounded-card border border-dashed border-control p-8 ${className ?? ""}`.trim()}
    >
      <IoCalendarClearOutline aria-hidden="true" focusable="false" className="h-7 w-7 text-text-secondary" />
      <div>
        <h2 className="m-0 text-[18px] font-bold">Sin datos para {rangeLabel}</h2>
        <p className="m-0 mt-1 max-w-[52ch] text-[15px] text-text-secondary">
          Todavía no hay aportes ni distribuciones registradas en este período. Elegí un período anterior.
        </p>
      </div>
      <Button variant="secondary" onPress={onReset}>
        Ver {defaultRangeLabel}
      </Button>
    </div>
  );
}
