import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../build-app.js";
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

describe("GET /rates/current (#572)", () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => app?.close());

  const RATE = { version: 3, effectiveAt: "2026-10-06T00:00:00.000Z", authorUserId: "admin-user-id", source: "manual" as const, usdToArs: 1_400_000_000n, stroopsPerUsd: 30_000_000n };

  function repository(findCurrent: RateTableRepositoryPort["findCurrent"]): RateTableRepositoryPort {
    return { create: vi.fn(), findCurrent };
  }

  it.each(["PYME", "INVERSOR"] as const)("serves the current rate to a signed-in %s with only its public fields", async (role) => {
    app = buildAppAs(role, { rateTable: { repository: repository(vi.fn().mockResolvedValue({ ok: true, value: RATE })) } });

    const response = await app.inject({ method: "GET", url: "/rates/current", headers: bearer(role) });

    expect(response.statusCode).toBe(200);
    // Never the author or the source: those are admin metadata.
    expect(response.json()).toEqual({
      rate: { version: 3, effectiveAt: "2026-10-06T00:00:00.000Z", usdToArs: "1400000000", stroopsPerUsd: "30000000" }
    });
  });

  it("refuses an anonymous caller", async () => {
    const findCurrent = vi.fn();
    // `buildAppAs` adds a bearer to every request; the bare app has none.
    app = buildApp({ rateTable: { repository: repository(findCurrent) } });

    const response = await app.inject({ method: "GET", url: "/rates/current" });

    expect(response.statusCode).toBe(401);
    expect(findCurrent).not.toHaveBeenCalled();
  });

  it("answers 404 when no rate is in effect, never a made-up rate", async () => {
    app = buildAppAs("INVERSOR", {
      rateTable: { repository: repository(vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } })) }
    });

    const response = await app.inject({ method: "GET", url: "/rates/current", headers: bearer("INVERSOR") });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "not_found" });
  });

  it("answers a sanitized 503 when the rate table cannot be read", async () => {
    app = buildAppAs("PYME", {
      rateTable: { repository: repository(vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } })) }
    });

    const response = await app.inject({ method: "GET", url: "/rates/current", headers: bearer("PYME") });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });
});
