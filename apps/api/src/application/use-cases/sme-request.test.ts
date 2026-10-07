import { parseApplicationId, parseCorrelationId } from "@vaqcrow/contracts";
import type { SalesPeriodContract, SmeRequest } from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import type { SalesDataProviderPort } from "../ports/sales-data-provider-port.js";
import type { SmeRequestRepositoryPort } from "../ports/sme-request-repository-port.js";
import { getSmeRequest } from "./get-sme-request.js";
import { submitSmeRequest } from "./submit-sme-request.js";

const APPLICATION_ID = parseApplicationId("11111111-1111-4111-8111-111111111111");
const CORRELATION_ID = parseCorrelationId("22222222-2222-4222-8222-222222222222");
const OWNER = "e1111111-1111-4111-8111-111111111111";
const OTHER_OWNER = "f1111111-1111-4111-8111-111111111111";

const request: SmeRequest = {
  smeReference: "sme:SYN-PH-0001",
  declaredTotalArs: 15_000_000,
  periodStart: "2026-01",
  periodEnd: "2026-08",
  simuladoLabel: "SIMULADO"
};

const period: SalesPeriodContract = {
  period: "2026-01",
  amountArs: 3_150_000,
  status: "reported",
  evidenceRef: "sales:2026-01",
  simuladoLabel: "SIMULADO"
};

function repository(overrides: Partial<SmeRequestRepositoryPort> = {}): SmeRequestRepositoryPort {
  return {
    submit: vi
      .fn()
      .mockResolvedValue({ ok: true, value: { applicationId: APPLICATION_ID, request, applied: true, ownerUserId: OWNER } }),
    findByApplicationId: vi
      .fn()
      .mockResolvedValue({ ok: true, value: { applicationId: APPLICATION_ID, request, ownerUserId: OWNER } }),
    listAdminQueue: vi.fn(),
    ...overrides
  };
}

describe("submitSmeRequest", () => {
  it("generates the application id server-side and persists the validated request", async () => {
    const repo = repository();
    const generateApplicationId = vi.fn().mockReturnValue(APPLICATION_ID);

    const result = await submitSmeRequest(
      { repository: repo, generateApplicationId },
      { body: request, correlationId: CORRELATION_ID, ownerUserId: OWNER }
    );

    expect(repo.submit).toHaveBeenCalledWith({ applicationId: APPLICATION_ID, request, correlationId: CORRELATION_ID, ownerUserId: OWNER });
    expect(result).toEqual({ ok: true, value: { applicationId: APPLICATION_ID, request, applied: true } });
  });

  it("reports a replay with applied=false and the stored application id", async () => {
    const repo = repository({
      submit: vi.fn().mockResolvedValue({ ok: true, value: { applicationId: APPLICATION_ID, request, applied: false } })
    });

    const result = await submitSmeRequest(
      { repository: repo, generateApplicationId: () => parseApplicationId("99999999-9999-4999-8999-999999999999") },
      { body: request, correlationId: CORRELATION_ID, ownerUserId: OWNER }
    );

    expect(result).toEqual({ ok: true, value: { applicationId: APPLICATION_ID, request, applied: false } });
  });

  it.each([
    ["missing total", { ...request, declaredTotalArs: undefined }, { field: "declaredTotalArs", code: "required" }],
    ["negative total", { ...request, declaredTotalArs: -1 }, { field: "declaredTotalArs", code: "out_of_range" }],
    ["bad start format", { ...request, periodStart: "2026-13" }, { field: "periodStart", code: "invalid_format" }],
    ["bad end format", { ...request, periodEnd: "26-01" }, { field: "periodEnd", code: "invalid_format" }],
    ["end before start", { ...request, periodStart: "2026-05", periodEnd: "2026-01" }, { field: "periodEnd", code: "before_start" }]
  ])("rejects %s with a sanitized field error and never touches the repository", async (_name, body, expected) => {
    const repo = repository();

    const result = await submitSmeRequest(
      { repository: repo, generateApplicationId: () => APPLICATION_ID },
      { body, correlationId: CORRELATION_ID, ownerUserId: OWNER }
    );

    expect(result).toEqual({ ok: false, error: { code: "invalid_request", fieldErrors: [expected] } });
    expect(repo.submit).not.toHaveBeenCalled();
  });

  it("rejects a non-object body", async () => {
    const result = await submitSmeRequest(
      { repository: repository(), generateApplicationId: () => APPLICATION_ID },
      { body: null, correlationId: CORRELATION_ID, ownerUserId: OWNER }
    );

    expect(result).toEqual({
      ok: false,
      error: { code: "invalid_request", fieldErrors: [{ field: "body", code: "invalid" }] }
    });
  });

  it("maps a root-level issue (unknown key, empty path) to the body field as invalid, not required", async () => {
    const repo = repository();

    const result = await submitSmeRequest(
      { repository: repo, generateApplicationId: () => APPLICATION_ID },
      { body: { ...request, extra: true }, correlationId: CORRELATION_ID, ownerUserId: OWNER }
    );

    expect(result).toEqual({
      ok: false,
      error: { code: "invalid_request", fieldErrors: [{ field: "body", code: "invalid" }] }
    });
    expect(repo.submit).not.toHaveBeenCalled();
  });

  it("keeps field errors next to a root-level issue, root reported as invalid", async () => {
    const result = await submitSmeRequest(
      { repository: repository(), generateApplicationId: () => APPLICATION_ID },
      { body: { ...request, declaredTotalArs: -1, extra: true }, correlationId: CORRELATION_ID, ownerUserId: OWNER }
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid_request",
        fieldErrors: [
          { field: "declaredTotalArs", code: "out_of_range" },
          { field: "body", code: "invalid" }
        ]
      }
    });
  });

  it.each(["invalid_request", "unavailable", "not_found"] as const)(
    "maps repository failure %s to a sanitized error",
    async (code) => {
      const repo = repository({ submit: vi.fn().mockResolvedValue({ ok: false, error: { code } }) });

      const result = await submitSmeRequest(
        { repository: repo, generateApplicationId: () => APPLICATION_ID },
        { body: request, correlationId: CORRELATION_ID, ownerUserId: OWNER }
      );

      expect(result).toEqual({ ok: false, error: { code: code === "invalid_request" ? "invalid_request" : "unavailable", fieldErrors: [] } });
    }
  );
});

describe("getSmeRequest", () => {
  function sales(result: Awaited<ReturnType<SalesDataProviderPort["getPeriods"]>>): SalesDataProviderPort {
    return { getPeriods: vi.fn().mockResolvedValue(result), recordNextPeriod: vi.fn() };
  }

  it("returns the request with the sales series keyed by its smeReference", async () => {
    const salesData = sales({ ok: true, value: [period] });

    const result = await getSmeRequest({ repository: repository(), salesData }, { applicationId: APPLICATION_ID, ownerUserId: OWNER });

    expect(salesData.getPeriods).toHaveBeenCalledWith("sme:SYN-PH-0001");
    expect(result).toEqual({ ok: true, value: { request, salesPeriods: [period] } });
  });

  it("declares an empty series when the provider has no feed for the reference", async () => {
    const result = await getSmeRequest(
      { repository: repository(), salesData: sales({ ok: false, error: { code: "not_found" } }) },
      { applicationId: APPLICATION_ID, ownerUserId: OWNER }
    );

    expect(result).toEqual({ ok: true, value: { request, salesPeriods: [] } });
  });

  it("is not_found when the application has no request", async () => {
    const repo = repository({ findByApplicationId: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } }) });
    const salesData = sales({ ok: true, value: [] });

    const result = await getSmeRequest({ repository: repo, salesData }, { applicationId: APPLICATION_ID, ownerUserId: OWNER });

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
    expect(salesData.getPeriods).not.toHaveBeenCalled();
  });

  it("is unavailable when the repository or the provider is unavailable", async () => {
    const repo = repository({ findByApplicationId: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) });
    expect(
      await getSmeRequest({ repository: repo, salesData: sales({ ok: true, value: [] }) }, { applicationId: APPLICATION_ID, ownerUserId: OWNER })
    ).toEqual({ ok: false, error: { code: "unavailable" } });

    expect(
      await getSmeRequest(
        { repository: repository(), salesData: sales({ ok: false, error: { code: "unavailable" } }) },
        { applicationId: APPLICATION_ID, ownerUserId: OWNER }
      )
    ).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("is not_found for a request that belongs to another owner", async () => {
    const repo = repository({
      findByApplicationId: vi.fn().mockResolvedValue({
        ok: true,
        value: { applicationId: APPLICATION_ID, request, ownerUserId: OTHER_OWNER }
      })
    });
    const salesData = sales({ ok: true, value: [period] });

    const result = await getSmeRequest(
      { repository: repo, salesData },
      { applicationId: APPLICATION_ID, ownerUserId: OWNER }
    );

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
    expect(salesData.getPeriods).not.toHaveBeenCalled();
  });

  it("is not_found for a request whose owner predates ownership", async () => {
    const repo = repository({
      findByApplicationId: vi.fn().mockResolvedValue({
        ok: true,
        value: { applicationId: APPLICATION_ID, request }
      })
    });

    const result = await getSmeRequest(
      { repository: repo, salesData: sales({ ok: true, value: [period] }) },
      { applicationId: APPLICATION_ID, ownerUserId: OWNER }
    );

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
  });
});
