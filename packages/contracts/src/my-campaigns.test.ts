import { describe, expect, it } from "vitest";
import {
  myCampaignSchema,
  myCampaignsSchema,
  parseMyCampaigns
} from "./my-campaigns.js";

function without<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const copy = { ...value };
  Reflect.deleteProperty(copy, key);
  return copy;
}

/**
 * The PyME dashboard read model (`GET /my-campaigns`, Feature #434, WU1).
 *
 * The endpoint is `PYME`-only and its caller is always the verified principal;
 * the API scopes every read to that owner, so no owner id or other
 * caller-supplied identity ever crosses this boundary. Money is integer ARS or
 * a canonical seven-decimal XLM string (never a JSON float); `null` (never a
 * fabricated zero) is the honest "sin dato" for a missing distribution amount,
 * a missing declared sale or a missing image.
 */
const CAMPAIGN_ID = "123e4567-e89b-42d3-a456-426614174000";
const SECOND_CAMPAIGN_ID = "223e4567-e89b-42d3-a456-426614174000";
const DISTRIBUTION_ID = "323e4567-e89b-42d3-a456-426614174000";
const VAULT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
const HASH = "a".repeat(64);
const EXPLORER = "https://stellar.expert/explorer/testnet";

const campaign = {
  campaignId: CAMPAIGN_ID,
  name: "Panadería Sol",
  sector: "Alimentos",
  city: "CABA",
  imageUrl: `/marketplace/campaigns/${CAMPAIGN_ID}/image`,
  vaultAddress: VAULT,
  vaultExplorerUrl: `${EXPLORER}/contract/${VAULT}`,
  state: "funding",
  goalArs: 5000000,
  raisedArs: 2500000,
  fundedPercentBps: 2500,
  deadline: "2026-12-01T00:00:00.000Z",
  contributorsCount: 3,
  distributions: [
    {
      distributionId: DISTRIBUTION_ID,
      period: "2026-06",
      amountArs: 1250000,
      amountXlm: "12.5000000",
      state: "confirmed",
      transactionHash: HASH,
      explorerUrl: `${EXPLORER}/tx/${HASH}`
    }
  ],
  sales: [
    { period: "2026-06", salesArs: 9000000, status: "reported" },
    { period: "2026-07", salesArs: null, status: "missing" }
  ]
};

const response = { campaigns: [campaign] };

describe("parseMyCampaigns", () => {
  it("parses a fully populated dashboard", () => {
    expect(parseMyCampaigns(response)).toEqual(response);
  });

  it("accepts a PyME with no campaigns", () => {
    expect(myCampaignsSchema.parse({ campaigns: [] })).toEqual({ campaigns: [] });
  });

  it("accepts a campaign with no image, no raised ARS and no distributions (sin dato)", () => {
    const bare = {
      campaigns: [
        { ...campaign, imageUrl: null, raisedArs: null, distributions: [], sales: [] }
      ]
    };

    const parsed = myCampaignsSchema.parse(bare);
    expect(parsed.campaigns[0]?.imageUrl).toBeNull();
    expect(parsed.campaigns[0]?.raisedArs).toBeNull();
    expect(parsed.campaigns[0]?.distributions).toEqual([]);
  });

  it("accepts a legacy distribution and a missing sales month, never fabricating zero", () => {
    const legacy = {
      campaigns: [
        {
          ...campaign,
          distributions: [
            {
              distributionId: DISTRIBUTION_ID,
              period: null,
              amountArs: null,
              amountXlm: null,
              state: "failed",
              transactionHash: HASH,
              explorerUrl: null
            }
          ],
          sales: [{ period: "2026-08", salesArs: null, status: "missing" }]
        }
      ]
    };

    const parsed = myCampaignsSchema.parse(legacy);
    expect(parsed.campaigns[0]?.distributions[0]?.amountArs).toBeNull();
    expect(parsed.campaigns[0]?.distributions[0]?.amountXlm).toBeNull();
    expect(parsed.campaigns[0]?.sales[0]?.salesArs).toBeNull();
  });

  it("accepts the settled and refunding campaign states", () => {
    for (const state of ["funding", "settled", "refunding"] as const) {
      expect(myCampaignSchema.parse({ ...campaign, state }).state).toBe(state);
    }
  });

  it("accepts every persisted distribution state", () => {
    for (const state of ["submitted", "confirmed", "failed"] as const) {
      const value = { ...campaign, distributions: [{ ...campaign.distributions[0], state }] };
      expect(myCampaignSchema.parse(value).distributions[0]?.state).toBe(state);
    }
  });

  it("refuses an XLM amount that is not canonical seven-decimal form", () => {
    for (const amountXlm of ["12.5", "12.500000", "0", "-1.0000000"]) {
      const bad = {
        ...response,
        campaigns: [{ ...campaign, distributions: [{ ...campaign.distributions[0], amountXlm }] }]
      };
      expect(myCampaignsSchema.safeParse(bad).success, amountXlm).toBe(false);
    }
    expect(myCampaignSchema.safeParse({ ...campaign, distributions: [{ ...campaign.distributions[0], amountXlm: "0.0000000" }] }).success).toBe(true);
  });

  it("refuses a float where an integer ARS amount is required", () => {
    const bad = { ...response, campaigns: [{ ...campaign, goalArs: 5000000.5 }] };
    expect(myCampaignsSchema.safeParse(bad).success).toBe(false);
  });

  it("refuses fundedPercentBps outside 0..10000", () => {
    expect(myCampaignsSchema.safeParse({ ...response, campaigns: [{ ...campaign, fundedPercentBps: 10001 }] }).success).toBe(false);
    expect(myCampaignsSchema.safeParse({ ...response, campaigns: [{ ...campaign, fundedPercentBps: -1 }] }).success).toBe(false);
  });

  it("refuses a campaign state outside the vault vocabulary", () => {
    const bad = { ...response, campaigns: [{ ...campaign, state: "open" }] };
    expect(myCampaignsSchema.safeParse(bad).success).toBe(false);
  });

  it("refuses an image url that is not the API-relative campaign path", () => {
    const bad = { ...response, campaigns: [{ ...campaign, imageUrl: "https://bucket.example/x.png" }] };
    expect(myCampaignsSchema.safeParse(bad).success).toBe(false);
  });

  it("refuses an extra key (strict wire shape)", () => {
    expect(myCampaignsSchema.safeParse({ ...response, leaked: true }).success).toBe(false);
    expect(myCampaignsSchema.safeParse({ campaigns: [{ ...campaign, leaked: true }] }).success).toBe(false);
  });

  it("keeps two campaigns for the same PyME", () => {
    const two = { campaigns: [campaign, { ...campaign, campaignId: SECOND_CAMPAIGN_ID, name: "Panadería Norte" }] };
    expect(myCampaignsSchema.parse(two).campaigns).toHaveLength(2);
  });
});

describe("my campaigns Testnet transparency (#438/WU3)", () => {
  const distribution = campaign.distributions[0]!;

  it("accepts null explorer links when the API has no explorer base (local network)", () => {
    const local = {
      ...campaign,
      vaultExplorerUrl: null,
      distributions: [{ ...distribution, explorerUrl: null }]
    };

    const parsed = myCampaignSchema.parse(local);
    expect(parsed.vaultExplorerUrl).toBeNull();
    expect(parsed.distributions[0]?.explorerUrl).toBeNull();
  });

  it("requires the vault link, the distribution hash and its link (required-but-nullable)", () => {
    const withoutVaultLink = without(campaign, "vaultExplorerUrl");
    const withoutHash = without(distribution, "transactionHash");
    const withoutLink = without(distribution, "explorerUrl");

    expect(myCampaignSchema.safeParse(withoutVaultLink).success).toBe(false);
    expect(myCampaignSchema.safeParse({ ...campaign, distributions: [withoutHash] }).success).toBe(false);
    expect(myCampaignSchema.safeParse({ ...campaign, distributions: [withoutLink] }).success).toBe(false);
  });

  it("refuses a null or malformed distribution hash and a non-URL link", () => {
    for (const transactionHash of [null, "hash-mc-confirmed", "A".repeat(64)]) {
      expect(
        myCampaignSchema.safeParse({ ...campaign, distributions: [{ ...distribution, transactionHash }] }).success,
        String(transactionHash)
      ).toBe(false);
    }
    expect(myCampaignSchema.safeParse({ ...campaign, vaultExplorerUrl: "nope" }).success).toBe(false);
  });
});
