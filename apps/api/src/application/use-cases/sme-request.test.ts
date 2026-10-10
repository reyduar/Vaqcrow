import { parseApplicationId, parseCorrelationId } from "@vaqcrow/contracts";
import type { ApplicationId, SalesPeriodContract, SmeRequest } from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import type { BusinessRecord, BusinessRepositoryPort } from "../ports/business-repository-port.js";
import type { NotificationPublisherPort } from "../ports/notification-publisher-port.js";
import type { SalesDataProviderPort } from "../ports/sales-data-provider-port.js";
import type { SmeRequestRepositoryPort } from "../ports/sme-request-repository-port.js";
import type { WalletRepositoryPort } from "../ports/wallet-repository-port.js";
import { getSmeRequest } from "./get-sme-request.js";
import { submitSmeRequest } from "./submit-sme-request.js";
import type { SubmissionAssessmentDependencies } from "./submit-sme-request.js";

const APPLICATION_ID = parseApplicationId("11111111-1111-4111-8111-111111111111");
const EXISTING_ID = parseApplicationId("33333333-3333-4333-8333-333333333333");
const CORRELATION_ID = parseCorrelationId("22222222-2222-4222-8222-222222222222");
const OWNER = "e1111111-1111-4111-8111-111111111111";
const OTHER_OWNER = "f1111111-1111-4111-8111-111111111111";
/** A syntactically valid Freighter key; the use case only cares that one exists. */
const WALLET_KEY = `G${"A".repeat(55)}`;

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

const business: BusinessRecord = {
  businessId: "b1111111-1111-4111-8111-111111111111",
  ownerUserId: OWNER,
  name: "Panadería Sur",
  cuit: "30-12345678-9",
  sector: "Alimentos",
  city: "Córdoba",
  description: "Panadería de barrio",
  goalArs: 15_000_000,
  revenueShare: 5,
  createdAt: "2026-10-05T00:00:00.000Z",
  updatedAt: "2026-10-05T00:00:00.000Z"
};

const summary = { recipients: 1, inserted: 1, skipped: 0, emailsSent: 1, emailsFailed: 0, failed: false };

function repository(overrides: Partial<SmeRequestRepositoryPort> = {}): SmeRequestRepositoryPort {
  return {
    submit: vi
      .fn()
      .mockResolvedValue({ ok: true, value: { applicationId: APPLICATION_ID, request, applied: true, ownerUserId: OWNER } }),
    findByApplicationId: vi
      .fn()
      .mockResolvedValue({ ok: true, value: { applicationId: APPLICATION_ID, request, ownerUserId: OWNER } }),
    findReviewStateByApplicationId: vi.fn().mockResolvedValue({ ok: true, value: "awaiting_assessment" }),
    listAdminQueue: vi.fn(),
    findByOwner: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    ...overrides
  };
}

interface SubmitDeps {
  readonly repository: SmeRequestRepositoryPort;
  readonly wallet: Pick<WalletRepositoryPort, "readPublicKey">;
  readonly businesses: Pick<BusinessRepositoryPort, "findByOwner">;
  readonly notifications: Pick<NotificationPublisherPort, "publish">;
  readonly generateApplicationId: () => ApplicationId;
  readonly assessment?: SubmissionAssessmentDependencies;
}

function wallet(overrides: Partial<Pick<WalletRepositoryPort, "readPublicKey">> = {}): Pick<WalletRepositoryPort, "readPublicKey"> {
  return { readPublicKey: vi.fn().mockResolvedValue({ ok: true, value: WALLET_KEY }), ...overrides };
}

function businesses(overrides: Partial<Pick<BusinessRepositoryPort, "findByOwner">> = {}): Pick<BusinessRepositoryPort, "findByOwner"> {
  return { findByOwner: vi.fn().mockResolvedValue({ ok: true, value: business }), ...overrides };
}

function notifications(overrides: Partial<Pick<NotificationPublisherPort, "publish">> = {}): Pick<NotificationPublisherPort, "publish"> {
  return { publish: vi.fn().mockResolvedValue(summary), ...overrides };
}

function deps(overrides: Partial<SubmitDeps> = {}): SubmitDeps {
  return {
    repository: repository(),
    wallet: wallet(),
    businesses: businesses(),
    notifications: notifications(),
    generateApplicationId: () => APPLICATION_ID,
    ...overrides
  };
}

describe("submitSmeRequest", () => {
  it("generates the application id server-side and persists the validated request", async () => {
    const repo = repository();
    const generateApplicationId = vi.fn().mockReturnValue(APPLICATION_ID);

    const result = await submitSmeRequest(deps({ repository: repo, generateApplicationId }), {
      body: request,
      correlationId: CORRELATION_ID,
      ownerUserId: OWNER
    });

    expect(repo.submit).toHaveBeenCalledWith({ applicationId: APPLICATION_ID, request, correlationId: CORRELATION_ID, ownerUserId: OWNER });
    expect(result).toEqual({ ok: true, value: { applicationId: APPLICATION_ID, request, applied: true } });
  });

  it("reports a replay with applied=false and the stored application id", async () => {
    const repo = repository({
      submit: vi.fn().mockResolvedValue({ ok: true, value: { applicationId: APPLICATION_ID, request, applied: false } })
    });

    const result = await submitSmeRequest(
      deps({ repository: repo, generateApplicationId: () => parseApplicationId("99999999-9999-4999-8999-999999999999") }),
      { body: request, correlationId: CORRELATION_ID, ownerUserId: OWNER }
    );

    expect(result).toEqual({ ok: true, value: { applicationId: APPLICATION_ID, request, applied: false } });
  });

  it("rejects a submission when the principal has no stored wallet key", async () => {
    const repo = repository();
    const readPublicKey = vi.fn().mockResolvedValue({ ok: true, value: null });
    const publish = vi.fn().mockResolvedValue(summary);

    const result = await submitSmeRequest(
      deps({ repository: repo, wallet: wallet({ readPublicKey }), notifications: notifications({ publish }) }),
      {
        body: request,
        correlationId: CORRELATION_ID,
        ownerUserId: OWNER
      }
    );

    expect(readPublicKey).toHaveBeenCalledWith(OWNER);
    expect(result).toEqual({ ok: false, error: { code: "wallet_required" } });
    expect(repo.findByOwner).not.toHaveBeenCalled();
    expect(repo.submit).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it.each(["unavailable", "invalid_request", "not_found"] as const)(
    "is unavailable when the wallet read fails with %s",
    async (code) => {
      const readPublicKey = vi.fn().mockResolvedValue({ ok: false, error: { code } });

      const result = await submitSmeRequest(deps({ wallet: wallet({ readPublicKey }) }), {
        body: request,
        correlationId: CORRELATION_ID,
        ownerUserId: OWNER
      });

      expect(result).toEqual({ ok: false, error: { code: "unavailable", fieldErrors: [] } });
    }
  );

  it("returns the existing application for a replayed submission without applying again", async () => {
    const repo = repository({
      findByOwner: vi.fn().mockResolvedValue({ ok: true, value: [{ applicationId: EXISTING_ID, request, ownerUserId: OWNER }] })
    });
    const publish = vi.fn().mockResolvedValue(summary);

    const result = await submitSmeRequest(deps({ repository: repo, notifications: notifications({ publish }) }), {
      body: request,
      correlationId: CORRELATION_ID,
      ownerUserId: OWNER
    });

    expect(repo.findByOwner).toHaveBeenCalledWith(OWNER);
    expect(repo.submit).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, value: { applicationId: EXISTING_ID, request, applied: false } });
  });

  it("ignores another owner's stored request when checking for a replay", async () => {
    const repo = repository({
      findByOwner: vi.fn().mockResolvedValue({
        ok: true,
        value: [{ applicationId: EXISTING_ID, request, ownerUserId: OTHER_OWNER }]
      })
    });

    await submitSmeRequest(deps({ repository: repo }), { body: request, correlationId: CORRELATION_ID, ownerUserId: OWNER });

    // The guard only ever sees the principal's own rows; this row would be
    // filtered by the adapter, and the use case does not match it by content alone.
    expect(repo.submit).toHaveBeenCalledTimes(1);
  });

  it("is unavailable when the idempotency read fails, instead of risking a duplicate", async () => {
    const repo = repository({ findByOwner: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) });

    const result = await submitSmeRequest(deps({ repository: repo }), {
      body: request,
      correlationId: CORRELATION_ID,
      ownerUserId: OWNER
    });

    expect(result).toEqual({ ok: false, error: { code: "unavailable", fieldErrors: [] } });
    expect(repo.submit).not.toHaveBeenCalled();
  });

  it("publishes admin.new_application once on a real apply", async () => {
    const publish = vi.fn().mockResolvedValue(summary);

    const result = await submitSmeRequest(deps({ notifications: notifications({ publish }) }), {
      body: request,
      correlationId: CORRELATION_ID,
      ownerUserId: OWNER
    });

    expect(result.ok).toBe(true);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith({
      eventKey: `application:${APPLICATION_ID}:submitted`,
      type: "admin.new_application",
      smeName: "Panadería Sur"
    });
  });

  it("does not publish when the repository reports an idempotent transport replay", async () => {
    const repo = repository({
      submit: vi.fn().mockResolvedValue({ ok: true, value: { applicationId: APPLICATION_ID, request, applied: false } })
    });
    const publish = vi.fn().mockResolvedValue(summary);

    await submitSmeRequest(deps({ repository: repo, notifications: notifications({ publish }) }), {
      body: request,
      correlationId: CORRELATION_ID,
      ownerUserId: OWNER
    });

    expect(publish).not.toHaveBeenCalled();
  });

  it("publishes with a neutral fallback when the business cannot be resolved", async () => {
    const publish = vi.fn().mockResolvedValue(summary);
    const findByOwner = vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } });

    const result = await submitSmeRequest(
      deps({ businesses: businesses({ findByOwner }), notifications: notifications({ publish }) }),
      { body: request, correlationId: CORRELATION_ID, ownerUserId: OWNER }
    );

    expect(result.ok).toBe(true);
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ smeName: "PyME" }));
  });

  it("still succeeds when the publisher throws (best-effort)", async () => {
    const publish = vi.fn().mockRejectedValue(new Error("SECRET delivery failure"));

    const result = await submitSmeRequest(deps({ notifications: notifications({ publish }) }), {
      body: request,
      correlationId: CORRELATION_ID,
      ownerUserId: OWNER
    });

    expect(result).toEqual({ ok: true, value: { applicationId: APPLICATION_ID, request, applied: true } });
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });

  describe("automatic assessment (U12)", () => {
    it("starts the assessment exactly once on a real apply, with the application and correlation ids", async () => {
      const onSubmitted = vi.fn().mockResolvedValue(undefined);

      const result = await submitSmeRequest(deps({ assessment: { onSubmitted } }), {
        body: request,
        correlationId: CORRELATION_ID,
        ownerUserId: OWNER
      });

      expect(result).toEqual({ ok: true, value: { applicationId: APPLICATION_ID, request, applied: true } });
      expect(onSubmitted).toHaveBeenCalledTimes(1);
      expect(onSubmitted).toHaveBeenCalledWith({ applicationId: APPLICATION_ID, correlationId: CORRELATION_ID });
    });

    it("never awaits the assessment: a run that never settles does not hold the submission", async () => {
      const onSubmitted = vi.fn().mockReturnValue(new Promise<never>(() => undefined));

      const result = await submitSmeRequest(deps({ assessment: { onSubmitted } }), {
        body: request,
        correlationId: CORRELATION_ID,
        ownerUserId: OWNER
      });

      expect(result).toEqual({ ok: true, value: { applicationId: APPLICATION_ID, request, applied: true } });
      expect(onSubmitted).toHaveBeenCalledTimes(1);
    });

    it("does not assess an owner+content replay", async () => {
      const repo = repository({
        findByOwner: vi
          .fn()
          .mockResolvedValue({ ok: true, value: [{ applicationId: EXISTING_ID, request, ownerUserId: OWNER }] })
      });
      const onSubmitted = vi.fn().mockResolvedValue(undefined);

      const result = await submitSmeRequest(deps({ repository: repo, assessment: { onSubmitted } }), {
        body: request,
        correlationId: CORRELATION_ID,
        ownerUserId: OWNER
      });

      expect(result).toEqual({ ok: true, value: { applicationId: EXISTING_ID, request, applied: false } });
      expect(onSubmitted).not.toHaveBeenCalled();
    });

    it("does not assess a transport replay the repository reports as not applied", async () => {
      const repo = repository({
        submit: vi.fn().mockResolvedValue({ ok: true, value: { applicationId: APPLICATION_ID, request, applied: false } })
      });
      const onSubmitted = vi.fn().mockResolvedValue(undefined);

      await submitSmeRequest(deps({ repository: repo, assessment: { onSubmitted } }), {
        body: request,
        correlationId: CORRELATION_ID,
        ownerUserId: OWNER
      });

      expect(onSubmitted).not.toHaveBeenCalled();
    });

    it("does not assess a submission that failed", async () => {
      const repo = repository({ submit: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) });
      const onSubmitted = vi.fn().mockResolvedValue(undefined);

      const result = await submitSmeRequest(deps({ repository: repo, assessment: { onSubmitted } }), {
        body: request,
        correlationId: CORRELATION_ID,
        ownerUserId: OWNER
      });

      expect(result).toEqual({ ok: false, error: { code: "unavailable", fieldErrors: [] } });
      expect(onSubmitted).not.toHaveBeenCalled();
    });

    it.each([
      ["rejects", () => Promise.reject(new Error("SECRET provider failure"))],
      [
        "throws synchronously",
        () => {
          throw new Error("SECRET provider failure");
        }
      ]
    ])("keeps the submission result unchanged when the assessment %s", async (_name, implementation) => {
      const onSubmitted = vi.fn().mockImplementation(implementation);
      const publish = vi.fn().mockResolvedValue(summary);

      const result = await submitSmeRequest(
        deps({ assessment: { onSubmitted }, notifications: notifications({ publish }) }),
        { body: request, correlationId: CORRELATION_ID, ownerUserId: OWNER }
      );
      // Let a rejected promise settle: an unhandled rejection would fail the run.
      await new Promise((resolve) => setImmediate(resolve));

      expect(result).toEqual({ ok: true, value: { applicationId: APPLICATION_ID, request, applied: true } });
      expect(JSON.stringify(result)).not.toContain("SECRET");
      // The admin notification still goes out.
      expect(publish).toHaveBeenCalledTimes(1);
    });
  });

  it.each([
    ["missing total", { ...request, declaredTotalArs: undefined }, { field: "declaredTotalArs", code: "required" }],
    ["negative total", { ...request, declaredTotalArs: -1 }, { field: "declaredTotalArs", code: "out_of_range" }],
    ["bad start format", { ...request, periodStart: "2026-13" }, { field: "periodStart", code: "invalid_format" }],
    ["bad end format", { ...request, periodEnd: "26-01" }, { field: "periodEnd", code: "invalid_format" }],
    ["end before start", { ...request, periodStart: "2026-05", periodEnd: "2026-01" }, { field: "periodEnd", code: "before_start" }]
  ])("rejects %s with a sanitized field error and never touches the repository", async (_name, body, expected) => {
    const repo = repository();

    const result = await submitSmeRequest(deps({ repository: repo }), {
      body,
      correlationId: CORRELATION_ID,
      ownerUserId: OWNER
    });

    expect(result).toEqual({ ok: false, error: { code: "invalid_request", fieldErrors: [expected] } });
    expect(repo.submit).not.toHaveBeenCalled();
  });

  it("rejects a non-object body", async () => {
    const result = await submitSmeRequest(deps(), { body: null, correlationId: CORRELATION_ID, ownerUserId: OWNER });

    expect(result).toEqual({
      ok: false,
      error: { code: "invalid_request", fieldErrors: [{ field: "body", code: "invalid" }] }
    });
  });

  it("maps a root-level issue (unknown key, empty path) to the body field as invalid, not required", async () => {
    const repo = repository();

    const result = await submitSmeRequest(deps({ repository: repo }), {
      body: { ...request, extra: true },
      correlationId: CORRELATION_ID,
      ownerUserId: OWNER
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "invalid_request", fieldErrors: [{ field: "body", code: "invalid" }] }
    });
    expect(repo.submit).not.toHaveBeenCalled();
  });

  it("keeps field errors next to a root-level issue, root reported as invalid", async () => {
    const result = await submitSmeRequest(deps(), {
      body: { ...request, declaredTotalArs: -1, extra: true },
      correlationId: CORRELATION_ID,
      ownerUserId: OWNER
    });

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

      const result = await submitSmeRequest(deps({ repository: repo }), {
        body: request,
        correlationId: CORRELATION_ID,
        ownerUserId: OWNER
      });

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
    expect(result).toEqual({
      ok: true,
      value: { request, salesPeriods: [period], state: "awaiting_assessment" }
    });
  });

  it("declares an empty series when the provider has no feed for the reference", async () => {
    const result = await getSmeRequest(
      { repository: repository(), salesData: sales({ ok: false, error: { code: "not_found" } }) },
      { applicationId: APPLICATION_ID, ownerUserId: OWNER }
    );

    expect(result).toEqual({ ok: true, value: { request, salesPeriods: [], state: "awaiting_assessment" } });
  });

  it("returns the application's own review state, whatever it is", async () => {
    for (const state of ["draft", "awaiting_assessment", "human_review", "approved", "changes_requested", "rejected"] as const) {
      const repo = repository({
        findReviewStateByApplicationId: vi.fn().mockResolvedValue({ ok: true, value: state })
      });

      const result = await getSmeRequest(
        { repository: repo, salesData: sales({ ok: true, value: [period] }) },
        { applicationId: APPLICATION_ID, ownerUserId: OWNER }
      );

      expect(result).toEqual({ ok: true, value: { request, salesPeriods: [period], state } });
      expect(repo.findReviewStateByApplicationId).toHaveBeenCalledWith(APPLICATION_ID);
    }
  });

  it("is unavailable when the review-state read fails, never inventing a state", async () => {
    const repo = repository({
      findReviewStateByApplicationId: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } })
    });

    const result = await getSmeRequest(
      { repository: repo, salesData: sales({ ok: true, value: [period] }) },
      { applicationId: APPLICATION_ID, ownerUserId: OWNER }
    );

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("is not_found when the application has no request", async () => {
    const repo = repository({ findByApplicationId: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } }) });
    const salesData = sales({ ok: true, value: [] });

    const result = await getSmeRequest({ repository: repo, salesData }, { applicationId: APPLICATION_ID, ownerUserId: OWNER });

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
    expect(salesData.getPeriods).not.toHaveBeenCalled();
    expect(repo.findReviewStateByApplicationId).not.toHaveBeenCalled();
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
