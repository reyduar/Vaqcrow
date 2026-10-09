import { describe, expect, it } from "vitest";
import {
  parsePortfolioSummary,
  portfolioSummarySchema,
  xlmAmountSchema
} from "./portfolio.js";

/**
 * The investor portfolio read model (`GET /portfolio`, Feature #426, WU1).
 *
 * Money is a canonical decimal string with exactly seven decimals (1 XLM =
 * 10,000,000 stroops) — never a JSON float. `totalDistributionsXlm` is `null`
 * (not zero) when nothing has been confirmed. The response is a strict object:
 * a payload that carries an extra key, a float, or a status outside the
 * persisted vocabulary is refused rather than silently accepted.
 */
const CAMPAIGN_ID = "123e4567-e89b-42d3-a456-426614174000";
const SECOND_CAMPAIGN_ID = "223e4567-e89b-42d3-a456-426614174000";
const DISTRIBUTION_ID = "323e4567-e89b-42d3-a456-426614174000";
const VAULT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

const position = {
  campaignId: CAMPAIGN_ID,
  name: "Panadería Sol",
  sector: "Alimentos",
  city: "CABA",
  imageUrl: `/marketplace/campaigns/${CAMPAIGN_ID}/image`,
  contributionXlm: "150.0000000",
  raisedArs: 2500000,
  goalArs: 5000000,
  fundedPercentBps: 2500,
  status: "funding",
  closeDate: "2026-12-01T00:00:00.000Z",
  vaultAddress: VAULT
};

const distribution = {
  distributionId: DISTRIBUTION_ID,
  campaignId: CAMPAIGN_ID,
  campaignName: "Panadería Sol",
  period: "2026-06",
  amountXlm: "12.5000000",
  status: "confirmed"
};

const summary = {
  contributions: [position],
  distributions: [distribution],
  totals: {
    totalContributedXlm: "150.0000000",
    totalDistributionsXlm: "12.5000000",
    campaignCount: 1
  }
};

describe("parsePortfolioSummary", () => {
  it("parses a fully populated portfolio summary", () => {
    expect(parsePortfolioSummary(summary)).toEqual(summary);
  });

  it("accepts an empty portfolio with a null distribution total, never zero", () => {
    const empty = {
      contributions: [],
      distributions: [],
      totals: { totalContributedXlm: "0.0000000", totalDistributionsXlm: null, campaignCount: 0 }
    };

    expect(parsePortfolioSummary(empty)).toEqual(empty);
  });

  it("accepts a position whose PyME has no image (imageUrl null)", () => {
    const bare = {
      ...summary,
      contributions: [{ ...position, imageUrl: null, raisedArs: null, status: "refunding" }]
    };

    expect(portfolioSummarySchema.parse(bare).contributions[0]?.imageUrl).toBeNull();
    expect(portfolioSummarySchema.parse(bare).contributions[0]?.raisedArs).toBeNull();
  });

  it("accepts a distribution with no campaign link or period (legacy row)", () => {
    const legacy = {
      ...summary,
      distributions: [{ ...distribution, campaignId: null, campaignName: null, period: null, status: "failed" }]
    };

    const parsed = portfolioSummarySchema.parse(legacy);
    expect(parsed.distributions[0]?.campaignId).toBeNull();
    expect(parsed.distributions[0]?.period).toBeNull();
  });

  it("accepts the in-flight and failed persisted distribution states", () => {
    for (const status of ["submitted", "confirmed", "failed"] as const) {
      expect(portfolioSummarySchema.parse({ ...summary, distributions: [{ ...distribution, status }] })).toBeTruthy();
    }
  });

  it("refuses a float amount instead of accepting a lossy number", () => {
    const bad = { ...summary, contributions: [{ ...position, contributionXlm: 150.5 }] };
    expect(portfolioSummarySchema.safeParse(bad).success).toBe(false);
  });

  it("refuses an amount that is not canonical seven-decimal XLM", () => {
    for (const amount of ["150.5", "150.500000", "150", "0150.0000000", "-1.0000000"]) {
      expect(xlmAmountSchema.safeParse(amount).success, amount).toBe(false);
    }
    expect(xlmAmountSchema.safeParse("150.0000000").success).toBe(true);
    expect(xlmAmountSchema.safeParse("0.0000000").success).toBe(true);
  });

  it("refuses a status outside the vault vocabulary", () => {
    const bad = { ...summary, contributions: [{ ...position, status: "open" }] };
    expect(portfolioSummarySchema.safeParse(bad).success).toBe(false);
  });

  it("refuses an image url that is not the API-relative campaign path", () => {
    const bad = { ...summary, contributions: [{ ...position, imageUrl: "https://bucket.example/x.png" }] };
    expect(portfolioSummarySchema.safeParse(bad).success).toBe(false);
  });

  it("refuses an extra key (strict wire shape)", () => {
    expect(portfolioSummarySchema.safeParse({ ...summary, leaked: true }).success).toBe(false);
    expect(portfolioSummarySchema.safeParse({ ...summary, totals: { ...summary.totals, extra: 1 } }).success).toBe(false);
  });

  it("refuses a campaign id that is not a v4 uuid", () => {
    const bad = { ...summary, contributions: [{ ...position, campaignId: "not-a-uuid" }] };
    expect(portfolioSummarySchema.safeParse(bad).success).toBe(false);
  });

  it("keeps two positions for the same investor's distinct campaigns", () => {
    const two = {
      ...summary,
      contributions: [position, { ...position, campaignId: SECOND_CAMPAIGN_ID, name: "Panadería Norte" }],
      totals: { totalContributedXlm: "300.0000000", totalDistributionsXlm: null, campaignCount: 2 }
    };

    expect(portfolioSummarySchema.parse(two).contributions).toHaveLength(2);
  });
});
