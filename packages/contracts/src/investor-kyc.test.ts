import { describe, expect, it } from "vitest";
import { investorKycSchema, parseInvestorKyc } from "./index.js";

/**
 * The investor's simulated KYC state (`GET`/`POST /investor-kyc`, Feature #422,
 * WU4). These tests fix the wire shape: the owner never travels (it is always
 * the verified principal), a missing record is `approved: false` with a `null`
 * date, and the schema is strict so a drifted response is an error.
 */
const APPROVED = {
  approved: true,
  approvedAt: "2026-10-08T18:30:00.000Z",
  simulado: true
};

const ABSENT = {
  approved: false,
  approvedAt: null,
  simulado: true
};

describe("investorKycSchema", () => {
  it("parses an approved record", () => {
    expect(parseInvestorKyc(APPROVED)).toEqual(APPROVED);
  });

  it("parses the honest absent record with a null date", () => {
    expect(parseInvestorKyc(ABSENT)).toEqual(ABSENT);
  });

  it("rejects a non-boolean approved", () => {
    expect(investorKycSchema.safeParse({ ...APPROVED, approved: "yes" }).success).toBe(false);
  });

  it("rejects a non-ISO approvedAt", () => {
    expect(investorKycSchema.safeParse({ ...APPROVED, approvedAt: "ayer" }).success).toBe(false);
  });

  it("is strict: an unknown key is an error", () => {
    expect(investorKycSchema.safeParse({ ...APPROVED, userId: "leak" }).success).toBe(false);
  });
});
