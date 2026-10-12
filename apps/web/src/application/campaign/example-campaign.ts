import type { CampaignDetail } from "@/application/ports/campaign-detail-port";

/**
 * The synthetic campaign behind the landing's placeholder card (Issue #481).
 *
 * Frozen fixtures — no React and no fetch. The landing's «Oportunidad
 * destacada» placeholder («Panadería Horizonte SRL») links here so a visitor can
 * see the detail/evidence/risk layout even when no real campaign is published.
 * Every value is synthetic and the page marks it `SIMULADO`; the fixture must
 * never be presented as a real campaign, a Testnet hash or an explorer link, so
 * the vault is honestly `null` (the row reads «Sin dato»).
 *
 * Identity matches the placeholder card's `SIMULATED` (`featured-campaign.tsx`):
 * same name, image and headline numbers, so the card and the page it opens agree.
 */

/** English route of the synthetic example detail (owner decision, Issue #481). */
export const EXAMPLE_CAMPAIGN_PATH = "/campaigns/example";

/** Spanish copy for the example banner and the "actions unavailable" note. */
export const EXAMPLE_CAMPAIGN_COPY = Object.freeze({
  title: "Página de ejemplo",
  body: "Esta es una campaña ficticia que muestra cómo se ve el detalle de una campaña. Todos los valores son sintéticos y no representan una campaña real.",
  actionsNote:
    "En este ejemplo no se puede aportar: es una campaña ficticia para mostrar el detalle. No se contacta la API ni la red Stellar."
});

export const EXAMPLE_CAMPAIGN_DETAIL: CampaignDetail = {
  campaignId: "example",
  name: "Panadería Horizonte SRL",
  sector: "Alimentos",
  city: "Córdoba",
  description: "Panificados artesanales para comercios de cercanía, con ventas estables durante todo el año.",
  foundedAt: "2016-05-01T12:00:00.000Z",
  goalArs: 15_000_000,
  raisedArs: 9_450_000,
  fundedPercentBps: 6_300,
  revenueShare: 4.5,
  riskBand: "medium",
  riskConfidence: 0.6,
  closeDate: "2026-11-30T12:00:00.000Z",
  // A bundled demo asset, exactly as the placeholder card uses it.
  imageSrc: "/pyme-panaderia.jpg",
  status: "funding",
  backers: 37,
  // No real Testnet address in an example: the vault row stays the honest "Sin dato".
  vaultAddress: null,
  vaultExplorerUrl: null,
  assessment: {
    riskBand: "medium",
    confidence: 0.6,
    reasons: [
      "Ventas declaradas estables en los últimos ocho meses",
      "Clientes mayoristas y minoristas, sin dependencia de uno solo",
      "Documentación completa, sin antecedentes de mora"
    ],
    model: "evaluador-v1 (demo)",
    generatedAt: "2026-09-12T10:42:00.000Z"
  },
  decision: {
    // A neutral, synthetic actor — never a real person's name in an example.
    actor: "Administración Vaqcrow",
    reason: "Documentación completa y riesgo aceptable para el ejemplo",
    approvedLimitArs: 15_000_000,
    recordedAt: "2026-09-13T09:15:00.000Z"
  },
  salesEvidence: {
    averageMonthlyArs: 4_015_714,
    declaredMonths: 7,
    totalMonths: 8,
    months: [
      { period: "2026-01", salesArs: 3_150_000, status: "reported", source: "Declaración mensual sintética" },
      { period: "2026-02", salesArs: 3_420_000, status: "reported", source: "Declaración mensual sintética" },
      { period: "2026-03", salesArs: 3_980_000, status: "reported", source: "Declaración mensual sintética" },
      { period: "2026-04", salesArs: null, status: "missing", source: "Declaración mensual sintética" },
      { period: "2026-05", salesArs: 3_610_000, status: "reported", source: "Declaración mensual sintética" },
      { period: "2026-06", salesArs: 6_250_000, status: "anomalous", source: "Declaración mensual sintética" },
      { period: "2026-07", salesArs: 3_740_000, status: "reported", source: "Declaración mensual sintética" },
      { period: "2026-08", salesArs: 3_960_000, status: "reported", source: "Declaración mensual sintética" }
    ]
  }
};
