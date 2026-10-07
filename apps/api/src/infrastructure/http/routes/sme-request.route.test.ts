import { parseApplicationId } from "@vaqcrow/contracts";
import type { SmeRequest } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SalesDataProviderPort } from "../../../application/ports/sales-data-provider-port.js";
import type { SmeRequestRepositoryPort } from "../../../application/ports/sme-request-repository-port.js";
import { createSimulatedSalesDataProvider } from "../../adapters/simulated-sales-data-provider.js";
import { buildAppAs, principalFor } from "../test-support/auth.js";

const APPLICATION_ID = parseApplicationId("11111111-1111-4111-8111-111111111111");
const OWNER = principalFor("PYME").userId;
const OTHER_OWNER = "f1111111-1111-4111-8111-111111111111";

const request: SmeRequest = {
  smeReference: "sme:SYN-PH-0001",
  declaredTotalArs: 15_000_000,
  periodStart: "2026-01",
  periodEnd: "2026-08",
  simuladoLabel: "SIMULADO"
};

const period = {
  period: "2026-01",
  amountArs: 3_150_000,
  status: "reported",
  evidenceRef: "sales:2026-01",
  simuladoLabel: "SIMULADO"
} as const;

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

function build(
  repository: Partial<SmeRequestRepositoryPort> = {},
  salesData: Partial<SalesDataProviderPort> = {}
): FastifyInstance {
  app = buildAppAs("PYME", {
    smeRequest: {
      repository: {
        submit: vi.fn().mockResolvedValue({ ok: true, value: { applicationId: APPLICATION_ID, request, applied: true, ownerUserId: OWNER } }),
        findByApplicationId: vi.fn().mockResolvedValue({ ok: true, value: { applicationId: APPLICATION_ID, request, ownerUserId: OWNER } }),
        listAdminQueue: vi.fn().mockResolvedValue({ ok: true, value: { items: [], total: 0 } }),
        ...repository
      },
      salesData: {
        getPeriods: vi.fn().mockResolvedValue({ ok: true, value: [period] }),
        recordNextPeriod: vi.fn(),
        ...salesData
      },
      generateApplicationId: () => APPLICATION_ID
    }
  });
  return app;
}

describe("POST /sme-requests", () => {
  it("creates the application and returns 201 { applicationId, request }", async () => {
    const submit = vi.fn().mockResolvedValue({ ok: true, value: { applicationId: APPLICATION_ID, request, applied: true } });

    const response = await build({ submit }).inject({ method: "POST", url: "/sme-requests", payload: request });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ applicationId: APPLICATION_ID, request });
    expect(submit).toHaveBeenCalledWith({
      applicationId: APPLICATION_ID,
      request,
      // The transport request id doubles as the correlation id; the owner is the
      // verified principal, never part of the body.
      correlationId: response.headers["x-correlation-id"],
      ownerUserId: OWNER
    });
  });

  it("answers 200 with the same shape on an idempotent replay", async () => {
    const submit = vi.fn().mockResolvedValue({ ok: true, value: { applicationId: APPLICATION_ID, request, applied: false } });

    const response = await build({ submit }).inject({ method: "POST", url: "/sme-requests", payload: request });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ applicationId: APPLICATION_ID, request });
  });

  it("answers 400 with the { errors: [{ field, code }] } envelope and never persists", async () => {
    const submit = vi.fn();

    const response = await build({ submit }).inject({
      method: "POST",
      url: "/sme-requests",
      payload: { ...request, periodStart: "2026-05", periodEnd: "2026-01" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ errors: [{ field: "periodEnd", code: "before_start" }] });
    expect(submit).not.toHaveBeenCalled();
  });

  it("answers 400 for an empty body without leaking schema text", async () => {
    const response = await build().inject({ method: "POST", url: "/sme-requests" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ errors: [{ field: "body", code: "invalid" }] });
  });

  it("answers 400 with an empty errors list when only the database rejects the request", async () => {
    const submit = vi.fn().mockResolvedValue({ ok: false, error: { code: "invalid_request" } });

    const response = await build({ submit }).inject({ method: "POST", url: "/sme-requests", payload: request });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ errors: [] });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("answers 400 { body, invalid } for an unknown key without leaking schema text", async () => {
    const response = await build().inject({ method: "POST", url: "/sme-requests", payload: { ...request, extra: 1 } });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ errors: [{ field: "body", code: "invalid" }] });
  });

  it("answers 503 unavailable when persistence fails", async () => {
    const submit = vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } });

    const response = await build({ submit }).inject({ method: "POST", url: "/sme-requests", payload: request });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });
});

describe("GET /sme-requests/:applicationId", () => {
  it("returns { request, salesPeriods } with the series keyed by smeReference", async () => {
    const getPeriods = vi.fn().mockResolvedValue({ ok: true, value: [period] });

    const response = await build({}, { getPeriods }).inject({
      method: "GET",
      url: `/sme-requests/${APPLICATION_ID}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ request, salesPeriods: [period] });
    expect(getPeriods).toHaveBeenCalledWith("sme:SYN-PH-0001");
  });

  it("answers 400 for a malformed application id before any read", async () => {
    const findByApplicationId = vi.fn();

    const response = await build({ findByApplicationId }).inject({ method: "GET", url: "/sme-requests/current" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(findByApplicationId).not.toHaveBeenCalled();
  });

  it("answers 404 when the application has no request", async () => {
    const findByApplicationId = vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } });

    const response = await build({ findByApplicationId }).inject({
      method: "GET",
      url: `/sme-requests/${APPLICATION_ID}`
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "not_found" });
  });

  it("answers 404 (not another owner's data) for a request owned by someone else", async () => {
    const findByApplicationId = vi.fn().mockResolvedValue({
      ok: true,
      value: { applicationId: APPLICATION_ID, request, ownerUserId: OTHER_OWNER }
    });
    const getPeriods = vi.fn();

    const response = await build({ findByApplicationId }, { getPeriods }).inject({
      method: "GET",
      url: `/sme-requests/${APPLICATION_ID}`
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "not_found" });
    expect(getPeriods).not.toHaveBeenCalled();
  });

  it("answers 503 unavailable when the sales provider is unavailable", async () => {
    const getPeriods = vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } });

    const response = await build({}, { getPeriods }).inject({
      method: "GET",
      url: `/sme-requests/${APPLICATION_ID}`
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });
});

describe("GET /sme-requests/:applicationId with the simulated sales feed", () => {
  it("returns the real series for the synthetic SME reference", async () => {
    const response = await build({}, createSimulatedSalesDataProvider()).inject({
      method: "GET",
      url: `/sme-requests/${APPLICATION_ID}`
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.request).toEqual(request);
    expect(body.salesPeriods).toHaveLength(8);
    expect(body.salesPeriods[0]).toMatchObject({ period: "2026-01", simuladoLabel: "SIMULADO" });
  });

  it("still declares an empty series for an unknown SME reference", async () => {
    const unknown = { ...request, smeReference: "sme:UNKNOWN" };
    const findByApplicationId = vi
      .fn()
      .mockResolvedValue({ ok: true, value: { applicationId: APPLICATION_ID, request: unknown, ownerUserId: OWNER } });

    const response = await build({ findByApplicationId }, createSimulatedSalesDataProvider()).inject({
      method: "GET",
      url: `/sme-requests/${APPLICATION_ID}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().salesPeriods).toEqual([]);
  });
});

describe("GET /sme-requests", () => {
  const item = {
    applicationId: APPLICATION_ID,
    name: "Panadería Sol",
    sector: "Alimentos",
    state: "human_review",
    updatedAt: "2026-10-04T12:00:00.000Z"
  };

  function buildAdmin(repository: Partial<SmeRequestRepositoryPort> = {}): FastifyInstance {
    app = buildAppAs("ADMIN", {
      smeRequest: {
        repository: {
          submit: vi.fn(),
          findByApplicationId: vi.fn(),
          listAdminQueue: vi.fn().mockResolvedValue({ ok: true, value: { items: [], total: 0 } }),
          ...repository
        },
        salesData: {
          getPeriods: vi.fn().mockResolvedValue({ ok: true, value: [] })
        },
        generateApplicationId: () => APPLICATION_ID
      }
    });
    return app;
  }

  it("returns the page envelope and passes the parsed query to the repository", async () => {
    const listAdminQueue = vi.fn().mockResolvedValue({ ok: true, value: { items: [item], total: 1 } });

    const response = await buildAdmin({ listAdminQueue }).inject({
      method: "GET",
      url: "/sme-requests?page=2&pageSize=10&sort=name&order=asc&q=sol"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [item], page: 2, pageSize: 10, total: 1 });
    expect(listAdminQueue).toHaveBeenCalledWith({ page: 2, pageSize: 10, sort: "name", order: "asc", search: "sol" });
  });

  it("returns the defaults for an empty query", async () => {
    const listAdminQueue = vi.fn().mockResolvedValue({ ok: true, value: { items: [], total: 0 } });

    const response = await buildAdmin({ listAdminQueue }).inject({ method: "GET", url: "/sme-requests" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [], page: 1, pageSize: 20, total: 0 });
    expect(listAdminQueue).toHaveBeenCalledWith({ page: 1, pageSize: 20, sort: "updatedAt", order: "desc" });
  });

  it("answers a sanitized 400 for a malformed query without touching the repository", async () => {
    const listAdminQueue = vi.fn();

    const response = await buildAdmin({ listAdminQueue }).inject({ method: "GET", url: "/sme-requests?sort=bogus" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(listAdminQueue).not.toHaveBeenCalled();
  });

  it("answers 503 unavailable when the read fails, never an empty 200", async () => {
    const listAdminQueue = vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } });

    const response = await buildAdmin({ listAdminQueue }).inject({ method: "GET", url: "/sme-requests" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });
});
