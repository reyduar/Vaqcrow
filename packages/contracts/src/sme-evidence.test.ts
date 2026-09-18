import { describe, expect, it } from "vitest";
import {
  evidenceReferenceSchema,
  parseReviewFinding,
  parseSalesPeriod,
  parseSmeRequest,
  reviewFindingSchema,
  salesPeriodSchema,
  smeRequestSchema
} from "./index.js";

const validPeriod = {
  period: "2026-01",
  amountArs: 3_150_000,
  status: "reported",
  evidenceRef: "sales:2026-01",
  simuladoLabel: "SIMULADO"
};

const validRequest = {
  smeReference: "sme:PH-0001",
  declaredTotalArs: 15_000_000,
  periodStart: "2026-01",
  periodEnd: "2026-08",
  simuladoLabel: "SIMULADO"
};

describe("salesPeriodSchema", () => {
  it("parses a reported period", () => {
    expect(parseSalesPeriod(validPeriod)).toEqual(validPeriod);
  });

  it("accepts a null amount for a missing period", () => {
    const result = salesPeriodSchema.safeParse({
      ...validPeriod,
      amountArs: null,
      status: "missing"
    });
    expect(result.success).toBe(true);
  });

  it("CHARACTERIZATION: accepts a missing period that carries a numeric amount (cross-field rule lives outside the schema)", () => {
    const result = salesPeriodSchema.safeParse({ ...validPeriod, status: "missing", amountArs: 100 });
    expect(result.success).toBe(true);
  });

  it.each([
    ["bad period format", { period: "2026-13" }],
    ["bad period format", { period: "2026-1" }],
    ["unknown status", { status: "unknown" }],
    ["missing simulated label", { simuladoLabel: "REAL" }],
    ["undefined amount", { amountArs: undefined }],
    ["extra key", { extra: true }]
  ])("rejects %s", (_description, override) => {
    expect(salesPeriodSchema.safeParse({ ...validPeriod, ...override }).success).toBe(false);
  });
});

describe("smeRequestSchema", () => {
  it("parses a valid request", () => {
    expect(parseSmeRequest(validRequest)).toEqual(validRequest);
  });

  it.each([
    ["negative total", { declaredTotalArs: -1 }],
    ["non-numeric total", { declaredTotalArs: "15000000" }],
    ["bad period start", { periodStart: "2026/01" }],
    ["empty SME reference", { smeReference: "" }],
    ["extra key", { extra: 1 }]
  ])("rejects %s", (_description, override) => {
    expect(smeRequestSchema.safeParse({ ...validRequest, ...override }).success).toBe(false);
  });

  it("rejects a period range that ends before it starts", () => {
    const result = smeRequestSchema.safeParse({
      ...validRequest,
      periodStart: "2026-08",
      periodEnd: "2026-01"
    });
    expect(result.success).toBe(false);
  });
});

describe("evidenceReferenceSchema", () => {
  it("parses a non-empty reference", () => {
    expect(evidenceReferenceSchema.safeParse("sales:2026-01").success).toBe(true);
  });

  it("rejects an empty reference", () => {
    expect(evidenceReferenceSchema.safeParse("").success).toBe(false);
  });
});

describe("reviewFindingSchema", () => {
  it.each(["missing", "anomalous", "contradictory"])("accepts kind %s", (kind) => {
    const finding = {
      kind,
      period: "2026-04",
      evidenceRef: "missing:2026-04",
      messageKey: `review.finding.${kind}`
    };
    expect(parseReviewFinding(finding)).toEqual(finding);
  });

  it("accepts a finding without period or reference (request-level)", () => {
    const finding = { kind: "contradictory", messageKey: "review.finding.contradictory" };
    expect(reviewFindingSchema.safeParse(finding).success).toBe(true);
  });

  it.each([
    ["unknown kind", { kind: "other", messageKey: "k" }],
    ["empty message key", { kind: "missing", messageKey: "" }],
    ["extra key", { kind: "missing", messageKey: "k", extra: 1 }]
  ])("rejects %s", (_description, finding) => {
    expect(reviewFindingSchema.safeParse(finding).success).toBe(false);
  });
});
