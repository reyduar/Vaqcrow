import { describe, expect, it, vi } from "vitest";
import type { InvestorKycApproveResult } from "../ports/investor-kyc-repository-port.js";
import { approveInvestorKyc } from "./approve-investor-kyc.js";

/**
 * `POST /investor-kyc` (Feature #422, WU4). The owner always comes from the
 * caller (the verified principal). The repository's idempotent `approve`
 * reports whether it created the row; the use case surfaces that so the route
 * can answer 201 on create and 200 on a replay. A repository failure is
 * `unavailable`, never a false approval.
 */
const USER_ID = "00000000-0000-4000-8000-000000000002";

function repository(result: InvestorKycApproveResult) {
  return { approve: vi.fn().mockResolvedValue(result) };
}

describe("approveInvestorKyc", () => {
  it("approves and reports creation for the caller", async () => {
    const kyc = repository({
      ok: true,
      value: { approvedAt: "2026-10-08T18:30:00.000Z", simulado: true, created: true }
    });

    const result = await approveInvestorKyc({ kyc }, USER_ID);

    expect(result).toEqual({
      ok: true,
      value: { approved: true, approvedAt: "2026-10-08T18:30:00.000Z", simulado: true, created: true }
    });
    expect(kyc.approve).toHaveBeenCalledWith(USER_ID);
  });

  it("is idempotent: a replay reports created:false with the existing record", async () => {
    const kyc = repository({
      ok: true,
      value: { approvedAt: "2026-10-08T18:30:00.000Z", simulado: true, created: false }
    });

    const result = await approveInvestorKyc({ kyc }, USER_ID);

    expect(result).toEqual({
      ok: true,
      value: { approved: true, approvedAt: "2026-10-08T18:30:00.000Z", simulado: true, created: false }
    });
  });

  it("is unavailable when the repository fails", async () => {
    const kyc = repository({ ok: false, error: { code: "unavailable" } });

    const result = await approveInvestorKyc({ kyc }, USER_ID);

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});
