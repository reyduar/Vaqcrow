import type { PortfolioPositionStatus } from "@vaqcrow/contracts";

/**
 * The portfolio's status vocabulary (Feature #426, WU2), mirroring the campaign
 * detail's exactly (`campaign-detail-view.tsx:69-71`): `funding` -> "Fondeo
 * abierto", `settled` -> "Meta alcanzada", `refunding` -> "Reembolso
 * disponible". Pure and React-free.
 */

export const PORTFOLIO_STATUS_COPY: Readonly<Record<PortfolioPositionStatus, string>> = {
  funding: "Fondeo abierto",
  settled: "Meta alcanzada",
  refunding: "Reembolso disponible"
};

/** `dd/mm/aaaa` in `es-AR`, the same day format the detail view uses. */
const DAY = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * The optional body under a position's status label.
 *
 * Only `funding` has a body, and it is the template's own sentence
 * (`Vaqcrow Portafolio.dc.html:262`), parameterized with the real close date:
 * "Podés retirar tu aporte hasta el cierre, el 30/11/2026." `settled` and
 * `refunding` render the label only: the template's settled body references a
 * settlement ledger that is not persisted anywhere, so it is deliberately not
 * fabricated here (owner-pending). An unparseable close date also yields no
 * body rather than an invented date.
 */
export function positionStatusBody(status: PortfolioPositionStatus, closeDate: string): string | undefined {
  if (status !== "funding") return undefined;
  const date = new Date(closeDate);
  if (Number.isNaN(date.getTime())) return undefined;
  return `Podés retirar tu aporte hasta el cierre, el ${DAY.format(date)}.`;
}
