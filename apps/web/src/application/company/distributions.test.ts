import { describe, expect, it } from "vitest";
import type { MyCampaign, MyCampaignDistribution } from "@/application/ports/my-campaigns-port";
import {
  MY_CAMPAIGN_DISTRIBUTION_STATE_COPY,
  MY_CAMPAIGN_DISTRIBUTION_STATE_TONE,
  toAggregateDistributionRows,
  toDistributionRows,
  canReviewAndSign
} from "./distributions";

function distribution(overrides: Partial<MyCampaignDistribution> = {}): MyCampaignDistribution {
  return {
    distributionId: "11111111-1111-4111-8111-111111111111",
    period: "2026-08",
    amountArs: 168_561,
    amountXlm: "1.2500000",
    state: "submitted",
    transactionHash: "a".repeat(64),
    explorerUrl: null,
    ...overrides
  };
}

function campaign(overrides: Partial<MyCampaign> = {}): MyCampaign {
  return {
    campaignId: "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10",
    name: "Campaña 2026 · Panadería Horizonte",
    sector: "Alimentos",
    city: "Córdoba",
    imageSrc: null,
    vaultAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2",
    vaultExplorerUrl: null,
    state: "funding",
    goalArs: 15_000_000,
    raisedArs: 9_450_000,
    fundedPercentBps: 6_300,
    deadline: "2026-11-30T12:00:00.000Z",
    contributorsCount: 38,
    distributions: [distribution()],
    sales: [],
    ...overrides
  };
}

describe("distribution state vocabulary", () => {
  it("uses the PyME-facing template copy", () => {
    expect(MY_CAMPAIGN_DISTRIBUTION_STATE_COPY).toEqual({
      submitted: "Enviada · pendiente de confirmación",
      confirmed: "Confirmada",
      failed: "Fallida"
    });
  });

  it("never describes a persisted submitted distribution as pending the PyME's signature", () => {
    // A persisted `submitted` row already carries `signed_xdr` + `transaction_hash`:
    // it was signed and sent, so it can never read as an outstanding signature.
    expect(MY_CAMPAIGN_DISTRIBUTION_STATE_COPY.submitted).toMatch(/^Enviada/);
    expect(MY_CAMPAIGN_DISTRIBUTION_STATE_COPY.submitted).not.toMatch(/pendiente de tu firma/i);
  });

  it("maps each state to a tone", () => {
    expect(MY_CAMPAIGN_DISTRIBUTION_STATE_TONE).toEqual({
      submitted: "caution",
      confirmed: "success",
      failed: "critical"
    });
  });

  it("opens the signing action only for a settled campaign", () => {
    expect(canReviewAndSign("settled")).toBe(true);
    expect(canReviewAndSign("funding")).toBe(false);
    expect(canReviewAndSign("refunding")).toBe(false);
  });
});

describe("toDistributionRows", () => {
  it("formats the ARS principal and the approximate XLM", () => {
    const [row] = toDistributionRows([distribution()]);
    expect(row).toEqual({
      distributionId: "11111111-1111-4111-8111-111111111111",
      periodLabel: "Agosto 2026",
      amountArs: "ARS 168.561",
      amountXlm: "≈ 1,2500000 XLM",
      stateLabel: "Enviada · pendiente de confirmación",
      tone: "caution",
      transactionHash: "a".repeat(64),
      explorerUrl: null
    });
  });

  it("renders Sin dato for a null ARS or XLM amount, never a zero", () => {
    const [row] = toDistributionRows([distribution({ amountArs: null, amountXlm: null, period: null })]);
    expect(row!.amountArs).toBe("Sin dato");
    expect(row!.amountXlm).toBe("Sin dato");
    expect(row!.periodLabel).toBeNull();
  });
});

describe("distribution proof (#438/WU5)", () => {
  it("carries the hash and the API-built explorer link, keeping a null link null", () => {
    const [withLink] = toDistributionRows([distribution({ explorerUrl: "https://explorer.example/tx/a" })]);
    const [withoutLink] = toDistributionRows([distribution()]);

    expect(withLink!.transactionHash).toBe("a".repeat(64));
    expect(withLink!.explorerUrl).toBe("https://explorer.example/tx/a");
    expect(withoutLink!.explorerUrl).toBeNull();
  });
});

describe("toAggregateDistributionRows", () => {
  it("flattens every campaign's distributions with its campaign name", () => {
    const rows = toAggregateDistributionRows([
      campaign({ distributions: [distribution()] }),
      campaign({
        campaignId: "99999999-9999-4999-8999-999999999999",
        name: "Campaña 2026 · Café Tostadero",
        distributions: [
          distribution({ distributionId: "22222222-2222-4222-8222-222222222222", state: "confirmed", period: "2026-07" })
        ]
      })
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]!.campaignName).toBe("Campaña 2026 · Panadería Horizonte");
    expect(rows[1]!.campaignName).toBe("Campaña 2026 · Café Tostadero");
    expect(rows[1]!.stateLabel).toBe("Confirmada");
  });
});
