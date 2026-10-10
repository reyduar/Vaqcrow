import { describe, expect, it, vi } from "vitest";
import type { InvestorKycReadResult } from "../ports/investor-kyc-repository-port.js";
import { getInvestorKyc } from "./get-investor-kyc.js";

/**
 * `GET /investor-kyc` (Feature #422, WU4). The owner always comes from the
 * caller (the verified principal), a missing record is the honest
 * `approved: false` (never an error), and a repository failure is `unavailable`
 * — never a false "not approved" that would prompt a verification that already
 * happened.
 */
const USER_ID = "00000000-0000-4000-8000-000000000002";

function repository(result: InvestorKycReadResult) {
  return { find: vi.fn().mockResolvedValue(result) };
}

describe("getInvestorKyc", () => {
  it("answers approved:false with a null date when there is no record", async () => {
    const kyc = repository({ ok: true, value: null });

    const result = await getInvestorKyc({ kyc }, USER_ID);

    expect(result).toEqual({ ok: true, value: { approved: false, approvedAt: null, simulado: true } });
    expect(kyc.find).toHaveBeenCalledWith(USER_ID);
  });

  it("answers the stored approved record", async () => {
    const kyc = repository({
      ok: true,
      value: { approvedAt: "2026-10-08T18:30:00.000Z", simulado: true }
    });

    const result = await getInvestorKyc({ kyc }, USER_ID);

    expect(result).toEqual({
      ok: true,
      value: { approved: true, approvedAt: "2026-10-08T18:30:00.000Z", simulado: true }
    });
  });

  it("is unavailable when the repository fails, never a false negative", async () => {
    const kyc = repository({ ok: false, error: { code: "unavailable" } });

    const result = await getInvestorKyc({ kyc }, USER_ID);

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});
