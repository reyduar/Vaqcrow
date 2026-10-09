import { parseSalesPeriod } from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import type { BusinessRecord, BusinessRepositoryPort } from "../../../application/ports/business-repository-port.js";
import type { SalesDataProviderPort } from "../../../application/ports/sales-data-provider-port.js";
import { createSimulatedSalesDataProvider } from "../../adapters/simulated-sales-data-provider.js";
import { buildAppAs, principalFor } from "../test-support/auth.js";

/**
 * The HTTP surface of the monthly sales feed (Task #83).
 *
 * The provider under test is the real simulated adapter — deterministic and
 * frozen — so every case runs with no network and no credential, and the
 * status mapping is tested against the same typed codes the production path
 * produces. Response periods are parsed against the shared
 * `salesPeriodSchema` so "consistent with the contracts" is an assertion,
 * not a comment.
 */

const BUSINESS = "panaderia-horizonte";
const SERIES_URL = `/businesses/${BUSINESS}/sales-periods`;
const OWNER = principalFor("PYME").userId;

const BUSINESS_RECORD: BusinessRecord = {
  businessId: BUSINESS,
  ownerUserId: OWNER,
  name: "Panadería Horizonte",
  cuit: "20123456789",
  sector: "Alimentos",
  city: "CABA",
  description: "Panadería artesanal de barrio",
  goalArs: 5_000_000,
  revenueShare: 5,
  createdAt: "2026-10-03T12:00:00.000Z",
  updatedAt: "2026-10-03T12:00:00.000Z"
};

function businesses(
  findOwnedById: BusinessRepositoryPort["findOwnedById"] = vi
    .fn()
    .mockResolvedValue({ ok: true, value: BUSINESS_RECORD })
): Pick<BusinessRepositoryPort, "findOwnedById"> {
  return { findOwnedById };
}

function appWith(
  provider: SalesDataProviderPort = createSimulatedSalesDataProvider(),
  owned: Pick<BusinessRepositoryPort, "findOwnedById"> = businesses()
) {
  return buildAppAs("PYME", { salesFeed: { provider, businesses: owned } });
}

describe("GET /businesses/:businessId/sales-periods", () => {
  it("returns the eight historical periods, each contract-shaped with provenance and SIMULADO", async () => {
    const response = await appWith().inject({ method: "GET", url: SERIES_URL });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.businessId).toBe(BUSINESS);
    expect(body.periods).toHaveLength(8);
    for (const period of body.periods) {
      const parsed = parseSalesPeriod(period);
      expect(parsed.simuladoLabel).toBe("SIMULADO");
      expect(parsed.provenance).toBe("Declaración mensual sintética");
    }
    expect(body.periods[3]).toMatchObject({ period: "2026-04", amountArs: null, status: "missing" });
    expect(body.periods[5]).toMatchObject({ period: "2026-06", status: "anomalous" });
  });

  it("serves the recorded period 2026-09 in the series after it was recorded", async () => {
    const app = appWith();
    await app.inject({ method: "POST", url: SERIES_URL, payload: {} });

    const response = await app.inject({ method: "GET", url: SERIES_URL });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.periods).toHaveLength(9);
    expect(parseSalesPeriod(body.periods[8])).toMatchObject({
      period: "2026-09",
      status: "reported",
      evidenceRef: "sales:2026-09"
    });
  });

  it("answers 404 when the feed has no series for a malformed identifier", async () => {
    const response = await appWith().inject({
      method: "GET",
      url: "/businesses/negocio%20inexistente/sales-periods"
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "not_found" });
  });

  it("answers 404 and never serves another owner's business", async () => {
    const getPeriods = vi.fn();
    const findOwnedById = vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } });

    const response = await appWith(
      { getPeriods, recordNextPeriod: vi.fn() } as unknown as SalesDataProviderPort,
      businesses(findOwnedById)
    ).inject({ method: "GET", url: SERIES_URL });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "not_found" });
    expect(getPeriods).not.toHaveBeenCalled();
    // The lookup is the caller's own id, never anything from the request.
    expect(findOwnedById).toHaveBeenCalledWith({ ownerUserId: OWNER, businessId: BUSINESS });
  });

  it("answers 503 when the ownership check cannot run", async () => {
    const owned = businesses(vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }));

    const response = await appWith(createSimulatedSalesDataProvider(), owned).inject({
      method: "GET",
      url: SERIES_URL
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });

  it("lets an ADMIN read without an ownership check, preserving the existing behaviour", async () => {
    const findOwnedById = vi.fn();
    const app = buildAppAs("ADMIN", {
      salesFeed: { provider: createSimulatedSalesDataProvider(), businesses: businesses(findOwnedById) }
    });

    const response = await app.inject({ method: "GET", url: SERIES_URL });

    expect(response.statusCode).toBe(200);
    expect(response.json().periods).toHaveLength(8);
    expect(findOwnedById).not.toHaveBeenCalled();
  });

  it("answers 503 with a sanitized code when the provider is unavailable", async () => {
    const response = await appWith(createSimulatedSalesDataProvider({ failWith: "unavailable" }))
      .inject({ method: "GET", url: SERIES_URL });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });

  it("carries the correlation id on the response", async () => {
    const response = await appWith().inject({ method: "GET", url: SERIES_URL });

    expect(response.headers["x-correlation-id"]).toBeTruthy();
  });
});

describe("POST /businesses/:businessId/sales-periods", () => {
  it("records the next period 201 with applied:true and a contract-shaped period", async () => {
    const response = await appWith().inject({ method: "POST", url: SERIES_URL, payload: {} });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.applied).toBe(true);
    expect(parseSalesPeriod(body.period)).toMatchObject({
      period: "2026-09",
      status: "reported",
      evidenceRef: "sales:2026-09",
      simuladoLabel: "SIMULADO",
      provenance: "Declaración mensual sintética"
    });
  });

  it("replays idempotently with 200 and applied:false, returning the same period", async () => {
    const app = appWith();
    const first = await app.inject({ method: "POST", url: SERIES_URL, payload: {} });

    const replay = await app.inject({ method: "POST", url: SERIES_URL, payload: {} });

    expect(replay.statusCode).toBe(200);
    expect(replay.json().applied).toBe(false);
    expect(replay.json().period).toEqual(first.json().period);
  });

  it("re-persists the provider's series after a record so the campaign detail never diverges (#422)", async () => {
    const saveForBusiness = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const app = buildAppAs("PYME", {
      salesFeed: {
        provider: createSimulatedSalesDataProvider(),
        businesses: businesses(),
        salesPeriods: { saveForBusiness }
      }
    });

    const response = await app.inject({ method: "POST", url: SERIES_URL, payload: {} });

    expect(response.statusCode).toBe(201);
    expect(saveForBusiness).toHaveBeenCalledTimes(1);
    const saved = saveForBusiness.mock.calls.at(0)?.at(0);
    expect(saved.businessId).toBe(BUSINESS);
    // The persisted series advances with the feed: nine months after the record.
    expect(saved.periods).toHaveLength(9);
    expect(saved.periods[8]).toMatchObject({ period: "2026-09", status: "reported" });
  });

  it("does not re-persist on an idempotent replay", async () => {
    const saveForBusiness = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const app = buildAppAs("PYME", {
      salesFeed: {
        provider: createSimulatedSalesDataProvider(),
        businesses: businesses(),
        salesPeriods: { saveForBusiness }
      }
    });

    await app.inject({ method: "POST", url: SERIES_URL, payload: {} });
    await app.inject({ method: "POST", url: SERIES_URL, payload: {} });

    expect(saveForBusiness).toHaveBeenCalledTimes(1);
  });

  it("still answers 201 when the persistence write fails (best-effort)", async () => {
    const saveForBusiness = vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } });
    const app = buildAppAs("PYME", {
      salesFeed: {
        provider: createSimulatedSalesDataProvider(),
        businesses: businesses(),
        salesPeriods: { saveForBusiness }
      }
    });

    const response = await app.inject({ method: "POST", url: SERIES_URL, payload: {} });

    expect(response.statusCode).toBe(201);
    expect(response.json().applied).toBe(true);
  });

  it("refuses a body with any key — the next period is the provider's decision, not the caller's", async () => {
    let called = false;
    const stub: SalesDataProviderPort = {
      getPeriods: async () => {
        called = true;
        return { ok: false, error: { code: "unavailable" } };
      },
      recordNextPeriod: async () => {
        called = true;
        return { ok: false, error: { code: "unavailable" } };
      }
    };

    const response = await appWith(stub).inject({
      method: "POST",
      url: SERIES_URL,
      payload: { period: "2026-10" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(called).toBe(false);
  });

  it("refuses a request with no body — the exact body key set is the empty object", async () => {
    const response = await appWith().inject({ method: "POST", url: SERIES_URL });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
  });

  it("answers 404 when the feed has no series for a malformed identifier", async () => {
    const response = await appWith().inject({
      method: "POST",
      url: "/businesses/negocio%20inexistente/sales-periods",
      payload: {}
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "not_found" });
  });

  it("answers 404 and never records onto another owner's business", async () => {
    const provider = {
      getPeriods: vi.fn(),
      recordNextPeriod: vi.fn()
    } as unknown as SalesDataProviderPort;
    const owned = businesses(vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } }));

    const response = await appWith(provider, owned).inject({
      method: "POST",
      url: SERIES_URL,
      payload: {}
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "not_found" });
    expect(provider.recordNextPeriod).not.toHaveBeenCalled();
  });

  it("answers 503 with a sanitized code when the provider is unavailable", async () => {
    const response = await appWith(createSimulatedSalesDataProvider({ failWith: "unavailable" }))
      .inject({ method: "POST", url: SERIES_URL, payload: {} });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });
});

describe("POST /businesses/:businessId/sales-periods — declared amounts (#434/WU1b)", () => {
  function declarable(
    saveForBusiness: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    provider: SalesDataProviderPort = createSimulatedSalesDataProvider(),
    owned: Pick<BusinessRepositoryPort, "findOwnedById"> = businesses()
  ) {
    return buildAppAs("PYME", {
      salesFeed: { provider, businesses: owned, salesPeriods: { saveForBusiness } }
    });
  }

  it("persists the declared months and answers 200 with them, source declared", async () => {
    const saveForBusiness = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const response = await declarable(saveForBusiness).inject({
      method: "POST",
      url: SERIES_URL,
      payload: {
        periods: [
          { period: "2026-01", salesArs: 3_150_000 },
          { period: "2026-04", salesArs: null }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.businessId).toBe(BUSINESS);
    expect(body.periods).toEqual([
      { period: "2026-01", amountArs: 3_150_000, status: "reported", source: "declared" },
      { period: "2026-04", amountArs: null, status: "missing", source: "declared" }
    ]);

    expect(saveForBusiness).toHaveBeenCalledTimes(1);
    const saved = saveForBusiness.mock.calls.at(0)?.at(0);
    expect(saved.businessId).toBe(BUSINESS);
    expect(saved.periods[0]).toMatchObject({ period: "2026-01", status: "reported", source: "declared" });
    expect(saved.periods[0].salesArs).toBe(3_150_000n);
    expect(saved.periods[1]).toEqual({ period: "2026-04", salesArs: null, status: "missing", source: "declared" });
  });

  it("flags an anomalous declared month and persists that status", async () => {
    const saveForBusiness = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const response = await declarable(saveForBusiness).inject({
      method: "POST",
      url: SERIES_URL,
      payload: {
        periods: [
          { period: "2026-01", salesArs: 100 },
          { period: "2026-02", salesArs: 300 }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().periods.map((period: { status: string }) => period.status)).toEqual([
      "reported",
      "anomalous"
    ]);
    const saved = saveForBusiness.mock.calls.at(0)?.at(0);
    expect(saved.periods[1]).toMatchObject({ period: "2026-02", status: "anomalous" });
  });

  it("never touches the simulated provider on the declared path", async () => {
    const provider = { getPeriods: vi.fn(), recordNextPeriod: vi.fn() } as unknown as SalesDataProviderPort;

    const response = await declarable(
      vi.fn().mockResolvedValue({ ok: true, value: undefined }),
      provider
    ).inject({
      method: "POST",
      url: SERIES_URL,
      payload: { periods: [{ period: "2026-01", salesArs: 1 }] }
    });

    expect(response.statusCode).toBe(200);
    expect(provider.getPeriods).not.toHaveBeenCalled();
    expect(provider.recordNextPeriod).not.toHaveBeenCalled();
  });

  it("answers 404 and never persists onto another owner's business", async () => {
    const saveForBusiness = vi.fn();
    const owned = businesses(vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } }));

    const response = await declarable(saveForBusiness, createSimulatedSalesDataProvider(), owned).inject({
      method: "POST",
      url: SERIES_URL,
      payload: { periods: [{ period: "2026-01", salesArs: 1 }] }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "not_found" });
    expect(saveForBusiness).not.toHaveBeenCalled();
  });

  it("answers 503 with a sanitized code when the persistence write fails", async () => {
    const saveForBusiness = vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } });

    const response = await declarable(saveForBusiness).inject({
      method: "POST",
      url: SERIES_URL,
      payload: { periods: [{ period: "2026-01", salesArs: 1 }] }
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });

  it("answers 503 when the sales-period writer is not wired", async () => {
    const app = buildAppAs("PYME", {
      salesFeed: { provider: createSimulatedSalesDataProvider(), businesses: businesses() }
    });

    const response = await app.inject({
      method: "POST",
      url: SERIES_URL,
      payload: { periods: [{ period: "2026-01", salesArs: 1 }] }
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });

  it.each([
    ["an empty periods array", { periods: [] }],
    ["a missing periods key", { amountArs: 1 }],
    ["an unknown top-level key", { periods: [{ period: "2026-01", salesArs: 1 }], extra: true }],
    ["an unknown key inside a period", { periods: [{ period: "2026-01", salesArs: 1, extra: true }] }],
    ["a negative amount", { periods: [{ period: "2026-01", salesArs: -1 }] }],
    ["a fractional amount", { periods: [{ period: "2026-01", salesArs: 1.5 }] }],
    ["a bad period format", { periods: [{ period: "2026-13", salesArs: 1 }] }],
    ["a non-array periods value", { periods: "2026-01" }]
  ])("refuses %s with 400 and never persists", async (_description, payload) => {
    const saveForBusiness = vi.fn();

    const response = await declarable(saveForBusiness).inject({ method: "POST", url: SERIES_URL, payload });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(saveForBusiness).not.toHaveBeenCalled();
  });

  it("preserves the demo refresh path when the body is the empty object", async () => {
    const saveForBusiness = vi.fn().mockResolvedValue({ ok: true, value: undefined });

    const response = await declarable(saveForBusiness).inject({ method: "POST", url: SERIES_URL, payload: {} });

    expect(response.statusCode).toBe(201);
    expect(response.json().applied).toBe(true);
    // The demo path re-persists the provider's series, not a declared one.
    const saved = saveForBusiness.mock.calls.at(0)?.at(0);
    expect(saved.periods[8]).toMatchObject({ period: "2026-09", status: "reported" });
  });
});

describe("sales-feed route registration", () => {
  it("is not registered when the dependency group is not supplied", async () => {
    const app = buildAppAs("PYME");

    const get = await app.inject({ method: "GET", url: SERIES_URL });
    const post = await app.inject({ method: "POST", url: SERIES_URL, payload: {} });

    expect(get.statusCode).toBe(404);
    expect(post.statusCode).toBe(404);
  });
});
