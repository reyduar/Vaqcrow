import { describe, expect, it } from "vitest";
import {
  campaignDetailSalesEvidenceSchema,
  campaignDetailSchema,
  campaignDetailStatusSchema,
  parseCampaignDetail
} from "./index.js";

function without<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const copy = { ...value };
  Reflect.deleteProperty(copy, key);
  return copy;
}

/**
 * The account-gated campaign detail (`GET /marketplace/campaigns/:campaignId`).
 * These tests fix the wire shape: only persisted facts travel, every
 * non-persisted field is an explicit `null` (never invented, never a
 * fabricated zero), the image path follows the listing rule, and the schema is
 * strict so a response that drifted is an error.
 */
const CAMPAIGN_ID = "123e4567-e89b-42d3-a456-426614174000";

const DETAIL = {
  campaignId: CAMPAIGN_ID,
  name: "Panadería Sol",
  sector: "Alimentos",
  city: "CABA",
  description: "Panadería artesanal con tres locales.",
  foundedAt: "2024-03-01T00:00:00.000Z",
  goalArs: 5_000_000,
  raisedArs: 1_500_000,
  fundedPercentBps: 3000,
  revenueShare: 5,
  riskBand: "medium",
  riskConfidence: 0.72,
  closeDate: "2026-12-01T00:00:00.000Z",
  imageUrl: null,
  status: "funding",
  backers: 12,
  vaultAddress: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
  vaultExplorerUrl:
    "https://stellar.expert/explorer/testnet/contract/CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
  assessment: {
    riskBand: "medium",
    confidence: 0.72,
    reasons: ["Ventas declaradas consistentes con los documentos."],
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
    averageMonthlyArs: 3_700_000,
    declaredMonths: 2,
    totalMonths: 3,
    months: [
      { period: "2026-01", salesArs: 3_150_000, status: "reported", source: "Declaración mensual sintética" },
      { period: "2026-02", salesArs: 4_250_000, status: "anomalous", source: "Declaración mensual sintética" },
      { period: "2026-03", salesArs: null, status: "missing", source: "Declaración mensual sintética" }
    ]
  }
};

describe("campaign detail contract", () => {
  it("accepts a fully populated published campaign detail", () => {
    expect(parseCampaignDetail(DETAIL)).toEqual(DETAIL);
  });

  it("accepts every non-persisted field as null (the honest sin dato), never a fabricated zero", () => {
    const bare = {
      ...DETAIL,
      raisedArs: null,
      riskBand: null,
      riskConfidence: null,
      imageUrl: null,
      vaultAddress: null,
      vaultExplorerUrl: null,
      assessment: null,
      decision: null
    };
    expect(campaignDetailSchema.safeParse(bare).success).toBe(true);
  });

  it("only accepts the API-relative campaign image path, never an absolute URL or storage path", () => {
    const imageUrl = `/marketplace/campaigns/${CAMPAIGN_ID}/image`;
    expect(campaignDetailSchema.safeParse({ ...DETAIL, imageUrl }).success).toBe(true);
    expect(campaignDetailSchema.safeParse({ ...DETAIL, imageUrl: "https://cdn.example.test/a.png" }).success).toBe(false);
    expect(campaignDetailSchema.safeParse({ ...DETAIL, imageUrl: "/pyme-documents/owner/photo/a.jpg" }).success).toBe(false);
  });

  it("accepts exactly the three derived statuses and rejects any other", () => {
    expect(campaignDetailStatusSchema.options).toEqual(["funding", "settled", "refunding"]);
    for (const status of ["funding", "settled", "refunding"]) {
      expect(campaignDetailSchema.safeParse({ ...DETAIL, status }).success).toBe(true);
    }
    expect(campaignDetailSchema.safeParse({ ...DETAIL, status: "open" }).success).toBe(false);
    expect(campaignDetailSchema.safeParse({ ...DETAIL, status: "closed" }).success).toBe(false);
  });

  it("rejects an assessment whose reasons are empty (the AI recommendation must cite at least one)", () => {
    expect(
      campaignDetailSchema.safeParse({ ...DETAIL, assessment: { ...DETAIL.assessment, reasons: [] } }).success
    ).toBe(false);
  });

  it("rejects a decision with a negative approved limit, and an out-of-range confidence", () => {
    expect(
      campaignDetailSchema.safeParse({ ...DETAIL, decision: { ...DETAIL.decision, approvedLimitArs: -1 } }).success
    ).toBe(false);
    expect(
      campaignDetailSchema.safeParse({ ...DETAIL, assessment: { ...DETAIL.assessment, confidence: 1.5 } }).success
    ).toBe(false);
  });

  it("is strict: an unknown key at any level is rejected (no owner id, no PII can sneak in)", () => {
    expect(campaignDetailSchema.safeParse({ ...DETAIL, ownerUserId: "leak" }).success).toBe(false);
    expect(
      campaignDetailSchema.safeParse({ ...DETAIL, assessment: { ...DETAIL.assessment, evidenceRefs: ["leak"] } }).success
    ).toBe(false);
    expect(campaignDetailSchema.safeParse({ ...DETAIL, decision: { ...DETAIL.decision, cuit: "20111111111" } }).success).toBe(
      false
    );
  });

  it("rejects a non-integer ARS amount, a bps above the cap and a malformed campaign id", () => {
    expect(campaignDetailSchema.safeParse({ ...DETAIL, goalArs: 1.5 }).success).toBe(false);
    expect(campaignDetailSchema.safeParse({ ...DETAIL, fundedPercentBps: 10_001 }).success).toBe(false);
    expect(campaignDetailSchema.safeParse({ ...DETAIL, campaignId: "not-a-uuid" }).success).toBe(false);
  });
});

describe("campaign detail sales evidence", () => {
  it("accepts a persisted sales-evidence block and an explicit null (the honest sin dato)", () => {
    expect(campaignDetailSchema.safeParse(DETAIL).success).toBe(true);
    expect(campaignDetailSchema.safeParse({ ...DETAIL, salesEvidence: null }).success).toBe(true);
  });

  it("keeps a missing month's sales as null, never a fabricated zero", () => {
    const months = [
      { period: "2026-01", salesArs: null, status: "missing", source: "Declaración mensual sintética" }
    ];
    expect(
      campaignDetailSalesEvidenceSchema.safeParse({
        averageMonthlyArs: null,
        declaredMonths: 0,
        totalMonths: 1,
        months
      }).success
    ).toBe(true);
  });

  it("accepts exactly the three month statuses and rejects any other", () => {
    for (const status of ["reported", "missing", "anomalous"]) {
      expect(
        campaignDetailSalesEvidenceSchema.safeParse({
          averageMonthlyArs: 100,
          declaredMonths: 1,
          totalMonths: 1,
          months: [{ period: "2026-01", salesArs: 100, status, source: "s" }]
        }).success
      ).toBe(true);
    }
    expect(
      campaignDetailSalesEvidenceSchema.safeParse({
        averageMonthlyArs: 100,
        declaredMonths: 1,
        totalMonths: 1,
        months: [{ period: "2026-01", salesArs: 100, status: "estimated", source: "s" }]
      }).success
    ).toBe(false);
  });

  it("rejects a malformed period, a negative amount and an unknown key in a month", () => {
    const base = { averageMonthlyArs: 100, declaredMonths: 1, totalMonths: 1, source: "s" };
    expect(
      campaignDetailSalesEvidenceSchema.safeParse({
        ...base,
        months: [{ period: "2026-13", salesArs: 100, status: "reported", source: "s" }]
      }).success
    ).toBe(false);
    expect(
      campaignDetailSalesEvidenceSchema.safeParse({
        ...base,
        months: [{ period: "2026-01", salesArs: -1, status: "reported", source: "s" }]
      }).success
    ).toBe(false);
    expect(
      campaignDetailSalesEvidenceSchema.safeParse({
        ...base,
        months: [{ period: "2026-01", salesArs: 100, status: "reported", source: "s", note: "leak" }]
      }).success
    ).toBe(false);
  });

  it("is strict: an unknown key on the evidence block is rejected", () => {
    expect(campaignDetailSchema.safeParse({ ...DETAIL, salesEvidence: { ...DETAIL.salesEvidence, total: 3 } }).success).toBe(
      false
    );
  });
});

describe("campaign detail Testnet transparency (#438/WU3)", () => {
  it("accepts a null vault link when the API has no explorer base (local network)", () => {
    expect(campaignDetailSchema.parse({ ...DETAIL, vaultExplorerUrl: null }).vaultExplorerUrl).toBeNull();
  });

  it("requires the vault link field (required-but-nullable)", () => {
    const withoutLink = without(DETAIL, "vaultExplorerUrl");
    expect(campaignDetailSchema.safeParse(withoutLink).success).toBe(false);
  });

  it("refuses a vault link without a vault address and a non-URL link", () => {
    expect(campaignDetailSchema.safeParse({ ...DETAIL, vaultAddress: null }).success).toBe(false);
    expect(campaignDetailSchema.safeParse({ ...DETAIL, vaultExplorerUrl: "nope" }).success).toBe(false);
  });
});
