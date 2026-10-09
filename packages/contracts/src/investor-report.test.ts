import { describe, expect, it } from "vitest";
import { xlmAmountSchema } from "./portfolio.js";
import {
  availableRangeSchema,
  investorReportSchema,
  parseInvestorReport,
  parseReportSalesByPyme,
  reportRangeSchema,
  reportSalesByPymeSchema
} from "./investor-report.js";

/**
 * The investor report read model (`GET /reports`, Feature #430, WU1).
 *
 * Money is a canonical seven-decimal XLM string, never a float. `null` is the
 * honest "sin dato" — a missing distribution amount, a missing declared sale, a
 * missing image — never a fabricated zero. The payload is a strict object: an
 * extra key, a float, or a state outside the persisted vocabulary is refused.
 */
const CAMPAIGN_ID = "123e4567-e89b-42d3-a456-426614174000";
const IMAGE_URL = `/marketplace/campaigns/${CAMPAIGN_ID}/image`;

const report = {
  range: { from: "2026-01", to: "2026-06" },
  availableRange: { firstPeriod: "2026-01", lastPeriod: "2026-06" },
  isEmpty: false,
  kpis: {
    contributedXlm: "150.0000000",
    confirmedDistributionsXlm: "12.5000000",
    pendingDistributionsCount: 1,
    pendingDistributionsXlm: "4.0000000",
    campaignsCount: 2
  },
  monthlySeries: [
    { period: "2026-05", amountXlm: null, state: "none" },
    { period: "2026-06", amountXlm: "12.5000000", state: "confirmed" }
  ],
  latestDistributions: [
    {
      date: "2026-07-01T00:00:00.000Z",
      pyme: "Panadería Sol",
      declaredSalesArs: 9000000,
      shareXlm: "12.5000000",
      state: "confirmed"
    }
  ]
};

const salesByPyme = {
  pymes: [
    {
      name: "Panadería Sol",
      sector: "Alimentos",
      imageUrl: IMAGE_URL,
      period: "2026-06",
      salesArs: 9000000,
      status: "reported"
    },
    {
      name: "Panadería Sol",
      sector: "Alimentos",
      imageUrl: null,
      period: "2026-07",
      salesArs: null,
      status: "missing"
    }
  ]
};

describe("investorReportSchema", () => {
  it("parses a fully populated report", () => {
    expect(parseInvestorReport(report)).toEqual(report);
  });

  it("parses an empty report with a null available range and empty series", () => {
    const empty = {
      range: { from: "2026-10", to: "2026-10" },
      availableRange: { firstPeriod: null, lastPeriod: null },
      isEmpty: true,
      kpis: {
        contributedXlm: "0.0000000",
        confirmedDistributionsXlm: "0.0000000",
        pendingDistributionsCount: 0,
        pendingDistributionsXlm: null,
        campaignsCount: 0
      },
      monthlySeries: [],
      latestDistributions: []
    };

    expect(parseInvestorReport(empty)).toEqual(empty);
  });

  it("accepts the three monthly point states and a null amount for none", () => {
    for (const state of ["confirmed", "pending", "none"] as const) {
      expect(
        investorReportSchema.parse({
          ...report,
          monthlySeries: [{ period: "2026-06", amountXlm: state === "none" ? null : "1.0000000", state }]
        }).monthlySeries[0]?.state
      ).toBe(state);
    }
  });

  it("accepts a latest distribution with no declared sale and no share (sin dato)", () => {
    const bare = {
      ...report,
      latestDistributions: [
        { date: "2026-07-01T00:00:00.000Z", pyme: "PyME", declaredSalesArs: null, shareXlm: null, state: "submitted" }
      ]
    };

    const parsed = investorReportSchema.parse(bare);
    expect(parsed.latestDistributions[0]?.declaredSalesArs).toBeNull();
    expect(parsed.latestDistributions[0]?.shareXlm).toBeNull();
  });

  it("accepts an available range with only one bound set", () => {
    expect(availableRangeSchema.parse({ firstPeriod: "2026-01", lastPeriod: null })).toBeTruthy();
    expect(availableRangeSchema.parse({ firstPeriod: null, lastPeriod: "2026-06" })).toBeTruthy();
  });

  it("refuses a range whose end precedes its start", () => {
    expect(reportRangeSchema.safeParse({ from: "2026-06", to: "2026-01" }).success).toBe(false);
    expect(investorReportSchema.safeParse({ ...report, range: { from: "2026-06", to: "2026-01" } }).success).toBe(false);
  });

  it("refuses a period outside YYYY-MM", () => {
    expect(reportRangeSchema.safeParse({ from: "2026-13", to: "2026-13" }).success).toBe(false);
    expect(reportRangeSchema.safeParse({ from: "2026-1", to: "2026-1" }).success).toBe(false);
  });

  it("refuses a float amount instead of accepting a lossy number", () => {
    const bad = { ...report, kpis: { ...report.kpis, contributedXlm: 150.5 } };
    expect(investorReportSchema.safeParse(bad).success).toBe(false);
  });

  it("refuses an amount that is not canonical seven-decimal XLM", () => {
    for (const amount of ["150.5", "150.500000", "150", "0150.0000000", "-1.0000000"]) {
      expect(xlmAmountSchema.safeParse(amount).success, amount).toBe(false);
    }
    expect(xlmAmountSchema.safeParse("0.0000000").success).toBe(true);
  });

  it("refuses a monthly state outside the report vocabulary", () => {
    const bad = { ...report, monthlySeries: [{ period: "2026-06", amountXlm: null, state: "settled" }] };
    expect(investorReportSchema.safeParse(bad).success).toBe(false);
  });

  it("refuses a latest distribution state outside the persisted vocabulary", () => {
    const bad = {
      ...report,
      latestDistributions: [{ ...report.latestDistributions[0], state: "calculated" }]
    };
    expect(investorReportSchema.safeParse(bad).success).toBe(false);
  });

  it("refuses a negative declared sale", () => {
    const bad = {
      ...report,
      latestDistributions: [{ ...report.latestDistributions[0], declaredSalesArs: -1 }]
    };
    expect(investorReportSchema.safeParse(bad).success).toBe(false);
  });

  it("refuses an extra key (strict wire shape)", () => {
    expect(investorReportSchema.safeParse({ ...report, leaked: true }).success).toBe(false);
    expect(investorReportSchema.safeParse({ ...report, kpis: { ...report.kpis, extra: 1 } }).success).toBe(false);
  });
});

describe("reportSalesByPymeSchema", () => {
  it("parses a sales-by-pyme block with reported and missing entries", () => {
    expect(parseReportSalesByPyme(salesByPyme)).toEqual(salesByPyme);
  });

  it("accepts an empty block", () => {
    expect(parseReportSalesByPyme({ pymes: [] })).toEqual({ pymes: [] });
  });

  it("accepts a missing month with a null sale, never zero", () => {
    const parsed = reportSalesByPymeSchema.parse({
      pymes: [{ name: "PyME", sector: "Alimentos", imageUrl: null, period: "2026-07", salesArs: null, status: "missing" }]
    });
    expect(parsed.pymes[0]?.salesArs).toBeNull();
  });

  it("refuses an anomalous-month sale that is not an integer", () => {
    const bad = { pymes: [{ ...salesByPyme.pymes[0], salesArs: 12.5 }] };
    expect(reportSalesByPymeSchema.safeParse(bad).success).toBe(false);
  });

  it("refuses a status outside the persisted sales vocabulary", () => {
    const bad = { pymes: [{ ...salesByPyme.pymes[0], status: "partial" }] };
    expect(reportSalesByPymeSchema.safeParse(bad).success).toBe(false);
  });

  it("refuses an image url that is not the API-relative campaign path", () => {
    const bad = { pymes: [{ ...salesByPyme.pymes[0], imageUrl: "https://bucket.example/x.png" }] };
    expect(reportSalesByPymeSchema.safeParse(bad).success).toBe(false);
  });

  it("refuses an extra key (strict wire shape)", () => {
    expect(reportSalesByPymeSchema.safeParse({ ...salesByPyme, leaked: true }).success).toBe(false);
  });
});
