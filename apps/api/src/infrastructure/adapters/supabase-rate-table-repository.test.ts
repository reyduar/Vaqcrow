import { describe, expect, it, vi } from "vitest";
import { SupabaseRateTableRepository } from "./supabase-rate-table-repository.js";

describe("SupabaseRateTableRepository", () => {
  it("writes integer rate fields as decimal strings", async () => {
    const single = vi.fn().mockResolvedValue({ data: { version: 1, effective_at: "2026-10-06T00:00:00.000Z", author_user_id: "a", source: "manual", usd_to_ars: "120000000", stroops_per_usd: "100" }, error: null });
    const insert = vi.fn().mockReturnValue({ select: () => ({ single }) });
    const client = { from: vi.fn().mockReturnValue({ insert }) };
    const result = await new SupabaseRateTableRepository(client as never).create({ version: 1, effectiveAt: "2026-10-06T00:00:00.000Z", authorUserId: "a", source: "manual", usdToArs: 120_000_000n, stroopsPerUsd: 100n });
    expect(result.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ usd_to_ars: "120000000", stroops_per_usd: "100" }));
  });
});
