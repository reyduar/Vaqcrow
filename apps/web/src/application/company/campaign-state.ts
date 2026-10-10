import type { MyCampaignState } from "@vaqcrow/contracts";

/**
 * The PyME-facing campaign state vocabulary (Feature #434, WU2), mirroring the
 * portfolio/detail vocabulary exactly (`application/portfolio/status.ts`):
 * `funding` -> "Fondeo abierto", `settled` -> "Meta alcanzada", `refunding` ->
 * "Reembolso disponible". Pure and React-free.
 */

/** Tone for the vault status block, mirroring `PortfolioPositionCard`. */
export type CampaignStateTone = "info" | "neutral" | "caution";

export const MY_CAMPAIGN_STATE_COPY: Readonly<Record<MyCampaignState, string>> = {
  funding: "Fondeo abierto",
  settled: "Meta alcanzada",
  refunding: "Reembolso disponible"
};

export const MY_CAMPAIGN_STATE_TONE: Readonly<Record<MyCampaignState, CampaignStateTone>> = {
  funding: "info",
  settled: "neutral",
  refunding: "caution"
};

/**
 * `"Fondeo abierto · 38 aportantes"` — the template joins the state label with
 * the contributor count (`Vaqcrow Portafolio.dc.html`, PyME vault row).
 */
export function vaultStatusTitle(state: MyCampaignState, contributors: number): string {
  const noun = contributors === 1 ? "aportante" : "aportantes";
  return `${MY_CAMPAIGN_STATE_COPY[state]} · ${contributors} ${noun}`;
}
