import { describe, expect, it } from "vitest";
import type {
  CampaignDetailRateSnapshot,
  CampaignDetailRecord,
  CampaignDetailRepositoryPort,
  CampaignDetailSalesEvidenceRecord
} from "../ports/campaign-detail-repository-port.js";
import { deriveCampaignDetailStatus, getCampaignDetail } from "./get-campaign-detail.js";

/**
 * The campaign detail use case. The interesting logic is the integer-only money
 * conversion (mirroring the listing), the derived lifecycle status, and the
 * honest `null`s for every non-persisted field. A repository failure is
 * `unavailable`; an unknown/unpublished campaign is `not_found`.
 */
const CAMPAIGN_ID = "123e4567-e89b-42d3-a456-426614174000";
const NOW = new Date("2026-10-08T12:00:00.000Z");
const EXPLORER = "https://stellar.expert/explorer/testnet";
const VAULT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

// 1000.000000 ARS per USD (scaled 1e6) and 1 USD = 1 XLM = 10_000_000 stroops:
// 2_500_000 stroops = 0.25 USD = 250 ARS.
const SNAPSHOT: CampaignDetailRateSnapshot = {
  version: 5,
  usdToArs: 1_000_000_000n,
  stroopsPerUsd: 10_000_000n
};

// Two declared months (one of them anomalous) and one missing: the declared
// count is 2 and the average is the mean of the declared months only
// (3_150_000 + 6_240_000) / 2 = 4_695_000; the missing month is excluded.
const SALES_EVIDENCE: CampaignDetailSalesEvidenceRecord = {
  months: [
    { period: "2026-01", salesArs: 3_150_000n, status: "reported", source: "Declaración mensual sintética" },
    { period: "2026-02", salesArs: 6_240_000n, status: "anomalous", source: "Declaración mensual sintética" },
    { period: "2026-03", salesArs: null, status: "missing", source: "Declaración mensual sintética" }
  ]
};

function record(
  overrides: Partial<CampaignDetailRecord> = {},
  rateSnapshot: CampaignDetailRateSnapshot | null = SNAPSHOT
): CampaignDetailRecord {
  return {
    campaignId: CAMPAIGN_ID,
    name: "Panadería Sol",
    sector: "Alimentos",
    city: "CABA",
    description: "Panadería artesanal con tres locales.",
    foundedAt: "2024-03-01T00:00:00.000Z",
    goalArs: 1000n,
    totalStroops: 2_500_000n,
    goalStroops: 10_000_000n,
    revenueShare: 5,
    deadline: "2026-12-01T00:00:00.000Z",
    state: "open",
    hasImage: false,
    vaultAddress: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
    backers: 12,
    assessment: {
      riskBand: "medium",
      confidence: 0.72,
      reasons: ["Ventas declaradas consistentes."],
      model: "simulated-v1",
      generatedAt: "2026-09-30T12:00:00.000Z"
    },
    decision: {
      actor: "Admin Vaqcrow",
      reason: "Aprobada tras revisar la evidencia.",
      approvedLimitArs: 5_000_000n,
      recordedAt: "2026-10-01T09:00:00.000Z"
    },
    salesEvidence: SALES_EVIDENCE,
    ...(rateSnapshot === null ? {} : { rateSnapshot }),
    ...overrides
  };
}

function fakeRepository(
  value: Awaited<ReturnType<CampaignDetailRepositoryPort["findPublished"]>>
): Pick<CampaignDetailRepositoryPort, "findPublished"> {
  return { findPublished: async () => value };
}

describe("getCampaignDetail", () => {
  it("shapes the persisted facts, converts stroops through the snapshot and derives the status", async () => {
    const result = await getCampaignDetail({ repository: fakeRepository({ ok: true, value: record() }), explorerBaseUrl: EXPLORER }, CAMPAIGN_ID, NOW);

    expect(result).toEqual({
      ok: true,
      value: {
        campaignId: CAMPAIGN_ID,
        name: "Panadería Sol",
        sector: "Alimentos",
        city: "CABA",
        description: "Panadería artesanal con tres locales.",
        foundedAt: "2024-03-01T00:00:00.000Z",
        goalArs: 1000,
        raisedArs: 250,
        fundedPercentBps: 2500,
        revenueShare: 5,
        riskBand: "medium",
        riskConfidence: 0.72,
        closeDate: "2026-12-01T00:00:00.000Z",
        imageUrl: null,
        status: "funding",
        backers: 12,
        vaultAddress: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
        vaultExplorerUrl: `${EXPLORER}/contract/${VAULT}`,
        assessment: {
          riskBand: "medium",
          confidence: 0.72,
          reasons: ["Ventas declaradas consistentes."],
          model: "simulated-v1",
          generatedAt: "2026-09-30T12:00:00.000Z"
        },
        decision: {
          actor: "Admin Vaqcrow",
          reason: "Aprobada tras revisar la evidencia.",
          approvedLimitArs: 5_000_000,
          recordedAt: "2026-10-01T09:00:00.000Z"
        },
        salesEvidence: {
          averageMonthlyArs: 4_695_000,
          declaredMonths: 2,
          totalMonths: 3,
          months: [
            { period: "2026-01", salesArs: 3_150_000, status: "reported", source: "Declaración mensual sintética" },
            { period: "2026-02", salesArs: 6_240_000, status: "anomalous", source: "Declaración mensual sintética" },
            { period: "2026-03", salesArs: null, status: "missing", source: "Declaración mensual sintética" }
          ]
        }
      }
    });
  });

  it("reports null for every non-persisted field (no snapshot, no assessment, no decision, no image, no vault)", async () => {
    const bare = record(
      {
        hasImage: false,
        vaultAddress: null,
        assessment: null,
        decision: null
      },
      null
    );
    const result = await getCampaignDetail({ repository: fakeRepository({ ok: true, value: bare }), explorerBaseUrl: EXPLORER }, CAMPAIGN_ID, NOW);

    expect(result.ok && result.value.raisedArs).toBeNull();
    expect(result.ok && result.value.riskBand).toBeNull();
    expect(result.ok && result.value.riskConfidence).toBeNull();
    expect(result.ok && result.value.assessment).toBeNull();
    expect(result.ok && result.value.decision).toBeNull();
    expect(result.ok && result.value.vaultAddress).toBeNull();
    // No vault means no link, even with an explorer base configured.
    expect(result.ok && result.value.vaultExplorerUrl).toBeNull();
    expect(result.ok && result.value.imageUrl).toBeNull();
  });

  it("reports null salesEvidence when the business has no persisted periods", async () => {
    const recordWithoutSales = { ...record() };
    delete recordWithoutSales.salesEvidence;
    const result = await getCampaignDetail(
      { repository: fakeRepository({ ok: true, value: recordWithoutSales }), explorerBaseUrl: EXPLORER },
      CAMPAIGN_ID,
      NOW
    );

    expect(result.ok && result.value.salesEvidence).toBeNull();
  });

  it("reports null salesEvidence for an empty month array", async () => {
    const result = await getCampaignDetail(
      { repository: fakeRepository({ ok: true, value: record({ salesEvidence: { months: [] } }) }), explorerBaseUrl: EXPLORER },
      CAMPAIGN_ID,
      NOW
    );

    expect(result.ok && result.value.salesEvidence).toBeNull();
  });

  it("nulls the average (and keeps the periods) when every month is missing", async () => {
    const allMissing: CampaignDetailSalesEvidenceRecord = {
      months: [
        { period: "2026-01", salesArs: null, status: "missing", source: "Declaración mensual sintética" },
        { period: "2026-02", salesArs: null, status: "missing", source: "Declaración mensual sintética" }
      ]
    };
    const result = await getCampaignDetail(
      { repository: fakeRepository({ ok: true, value: record({ salesEvidence: allMissing }) }), explorerBaseUrl: EXPLORER },
      CAMPAIGN_ID,
      NOW
    );

    expect(result.ok && result.value.salesEvidence).toEqual({
      averageMonthlyArs: null,
      declaredMonths: 0,
      totalMonths: 2,
      months: [
        { period: "2026-01", salesArs: null, status: "missing", source: "Declaración mensual sintética" },
        { period: "2026-02", salesArs: null, status: "missing", source: "Declaración mensual sintética" }
      ]
    });
  });

  it("points imageUrl at the API image path when the campaign has a photo", async () => {
    const result = await getCampaignDetail(
      { repository: fakeRepository({ ok: true, value: record({ hasImage: true }) }), explorerBaseUrl: EXPLORER },
      CAMPAIGN_ID,
      NOW
    );

    expect(result.ok && result.value.imageUrl).toBe(`/marketplace/campaigns/${CAMPAIGN_ID}/image`);
  });

  it("answers not_found for an unknown or unpublished campaign, without a half-built detail", async () => {
    const result = await getCampaignDetail(
      { repository: fakeRepository({ ok: true, value: undefined }), explorerBaseUrl: EXPLORER },
      CAMPAIGN_ID,
      NOW
    );

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
  });

  it("maps a repository failure to unavailable, never a fabricated detail", async () => {
    const result = await getCampaignDetail(
      { repository: fakeRepository({ ok: false, error: { code: "unavailable" } }), explorerBaseUrl: EXPLORER },
      CAMPAIGN_ID,
      NOW
    );

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("maps a malformed record to unavailable", async () => {
    const malformed = record({
      assessment: {
        riskBand: "critical" as unknown as "medium",
        confidence: 0.5,
        reasons: ["claim"],
        model: "model",
        generatedAt: "2026-09-30T12:00:00.000Z"
      }
    });
    const result = await getCampaignDetail({ repository: fakeRepository({ ok: true, value: malformed }), explorerBaseUrl: EXPLORER }, CAMPAIGN_ID, NOW);

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("links the vault to the explorer only when a base is configured (#438/WU3)", async () => {
    const linked = await getCampaignDetail(
      { repository: fakeRepository({ ok: true, value: record() }), explorerBaseUrl: EXPLORER },
      CAMPAIGN_ID,
      NOW
    );
    const local = await getCampaignDetail(
      { repository: fakeRepository({ ok: true, value: record() }), explorerBaseUrl: undefined },
      CAMPAIGN_ID,
      NOW
    );

    expect(linked.ok && linked.value.vaultExplorerUrl).toBe(`${EXPLORER}/contract/${VAULT}`);
    expect(local.ok && local.value.vaultExplorerUrl).toBeNull();
    expect(local.ok && local.value.vaultAddress).toBe(VAULT);
  });
});

describe("deriveCampaignDetailStatus", () => {
  const base = { state: "open" as const, deadline: "2026-12-01T00:00:00.000Z", totalStroops: 1n, goalStroops: 10n };

  it("is funding while open, before the deadline and under the goal", () => {
    expect(deriveCampaignDetailStatus(base, new Date("2026-11-01T00:00:00.000Z"))).toBe("funding");
  });

  it("is refunding once an open, under-goal campaign passes its deadline", () => {
    expect(deriveCampaignDetailStatus(base, new Date("2026-12-02T00:00:00.000Z"))).toBe("refunding");
  });

  it("is settled once an open campaign reaches its goal", () => {
    expect(deriveCampaignDetailStatus({ ...base, totalStroops: 10n }, new Date("2026-11-01T00:00:00.000Z"))).toBe("settled");
  });

  it("maps the mirror's own settled/refundable states", () => {
    expect(deriveCampaignDetailStatus({ ...base, state: "settled" }, new Date("2026-11-01T00:00:00.000Z"))).toBe("settled");
    expect(deriveCampaignDetailStatus({ ...base, state: "refundable" }, new Date("2026-11-01T00:00:00.000Z"))).toBe(
      "refunding"
    );
  });
});
