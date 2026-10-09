import { describe, expect, it } from "vitest";
import type {
  CampaignDetailRateSnapshot,
  CampaignDetailRecord,
  CampaignDetailRepositoryPort
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

// 1000.000000 ARS per USD (scaled 1e6) and 1 USD = 1 XLM = 10_000_000 stroops:
// 2_500_000 stroops = 0.25 USD = 250 ARS.
const SNAPSHOT: CampaignDetailRateSnapshot = {
  version: 5,
  usdToArs: 1_000_000_000n,
  stroopsPerUsd: 10_000_000n
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
    const result = await getCampaignDetail({ repository: fakeRepository({ ok: true, value: record() }) }, CAMPAIGN_ID, NOW);

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
    const result = await getCampaignDetail({ repository: fakeRepository({ ok: true, value: bare }) }, CAMPAIGN_ID, NOW);

    expect(result.ok && result.value.raisedArs).toBeNull();
    expect(result.ok && result.value.riskBand).toBeNull();
    expect(result.ok && result.value.riskConfidence).toBeNull();
    expect(result.ok && result.value.assessment).toBeNull();
    expect(result.ok && result.value.decision).toBeNull();
    expect(result.ok && result.value.vaultAddress).toBeNull();
    expect(result.ok && result.value.imageUrl).toBeNull();
  });

  it("points imageUrl at the API image path when the campaign has a photo", async () => {
    const result = await getCampaignDetail(
      { repository: fakeRepository({ ok: true, value: record({ hasImage: true }) }) },
      CAMPAIGN_ID,
      NOW
    );

    expect(result.ok && result.value.imageUrl).toBe(`/marketplace/campaigns/${CAMPAIGN_ID}/image`);
  });

  it("answers not_found for an unknown or unpublished campaign, without a half-built detail", async () => {
    const result = await getCampaignDetail(
      { repository: fakeRepository({ ok: true, value: undefined }) },
      CAMPAIGN_ID,
      NOW
    );

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
  });

  it("maps a repository failure to unavailable, never a fabricated detail", async () => {
    const result = await getCampaignDetail(
      { repository: fakeRepository({ ok: false, error: { code: "unavailable" } }) },
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
    const result = await getCampaignDetail({ repository: fakeRepository({ ok: true, value: malformed }) }, CAMPAIGN_ID, NOW);

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
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
