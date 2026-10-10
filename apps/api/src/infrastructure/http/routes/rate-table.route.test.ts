import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAppAs, bearer } from "../test-support/auth.js";
import type { RateTableRepositoryPort } from "../../../application/ports/rate-table-repository-port.js";

describe("rate table routes", () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => app?.close());

  it("allows ADMIN to write and read the current rate", async () => {
    const repository: RateTableRepositoryPort = {
      create: vi.fn().mockResolvedValue({ ok: true, value: { version: 1, effectiveAt: "2026-10-06T00:00:00.000Z", authorUserId: "admin", source: "manual", usdToArs: 120_000_000n, stroopsPerUsd: 100n } }),
      findCurrent: vi.fn().mockResolvedValue({ ok: true, value: { version: 1, effectiveAt: "2026-10-06T00:00:00.000Z", authorUserId: "admin", source: "manual", usdToArs: 120_000_000n, stroopsPerUsd: 100n } })
    };
    app = buildAppAs("ADMIN", { rateTable: { repository } });
    const response = await app.inject({ method: "POST", url: "/admin/rates", payload: { version: 1, effectiveAt: "2026-10-06T00:00:00.000Z", source: "manual", usdToArs: "120000000", stroopsPerUsd: "100" }, headers: bearer("ADMIN") });
    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body).rate.usdToArs).toBe("120000000");
  });

  it("rejects non-admin callers", async () => {
    app = buildAppAs("PYME", { rateTable: { repository: { create: vi.fn(), findCurrent: vi.fn() } as never } });
    expect((await app.inject({ method: "GET", url: "/admin/rates/current", headers: bearer("PYME") })).statusCode).toBe(403);
  });
});
