import type { RevenueShareDistributionState } from "@vaqcrow/contracts";

/**
 * The investor-facing distribution state vocabulary (Feature #426, WU2),
 * mirroring the template's portfolio rows (`Vaqcrow Portafolio.dc.html:290`):
 * `submitted` -> "Calculada · falta firma de la PyME", `confirmed` ->
 * "Confirmada". `failed` reuses the existing evidence vocabulary ("Fallida",
 * `evidence-timeline.ts:105`); a portfolio-specific failed phrasing is
 * owner-pending. Pure and React-free.
 */
export const PORTFOLIO_DISTRIBUTION_STATE_COPY: Readonly<Record<RevenueShareDistributionState, string>> = {
  submitted: "Calculada · falta firma de la PyME",
  confirmed: "Confirmada",
  failed: "Fallida"
};
