import { describe, expect, it } from "vitest";
import { smeRequestReadSchema, smeRequestSubmissionSchema } from "./index.js";

const APPLICATION_ID = "11111111-1111-4111-8111-111111111111";

const request = {
  smeReference: "sme:SYN-PH-0001",
  declaredTotalArs: 15_000_000,
  periodStart: "2026-01",
  periodEnd: "2026-08",
  simuladoLabel: "SIMULADO"
};

const salesPeriod = {
  period: "2026-01",
  amountArs: 3_150_000,
  status: "reported",
  evidenceRef: "sales:2026-01",
  simuladoLabel: "SIMULADO"
};

describe("smeRequestSubmissionSchema", () => {
  it("parses the application id together with the persisted request", () => {
    expect(smeRequestSubmissionSchema.parse({ applicationId: APPLICATION_ID, request })).toEqual({
      applicationId: APPLICATION_ID,
      request
    });
  });

  it("rejects a non-uuid application id, a missing request and unknown keys", () => {
    expect(smeRequestSubmissionSchema.safeParse({ applicationId: "nope", request }).success).toBe(false);
    expect(smeRequestSubmissionSchema.safeParse({ applicationId: APPLICATION_ID }).success).toBe(false);
    expect(
      smeRequestSubmissionSchema.safeParse({ applicationId: APPLICATION_ID, request, extra: 1 }).success
    ).toBe(false);
  });

  it("rejects an invalid embedded request", () => {
    expect(
      smeRequestSubmissionSchema.safeParse({
        applicationId: APPLICATION_ID,
        request: { ...request, periodEnd: "2025-12" }
      }).success
    ).toBe(false);
  });
});

describe("smeRequestReadSchema", () => {
  it("parses the request, its sales periods and the application review state", () => {
    expect(smeRequestReadSchema.parse({ request, salesPeriods: [salesPeriod], state: "human_review" })).toEqual({
      request,
      salesPeriods: [salesPeriod],
      state: "human_review"
    });
  });

  it("accepts an empty sales series and rejects malformed periods", () => {
    expect(smeRequestReadSchema.safeParse({ request, salesPeriods: [], state: "approved" }).success).toBe(true);
    expect(
      smeRequestReadSchema.safeParse({ request, salesPeriods: [{ period: "x" }], state: "approved" }).success
    ).toBe(false);
  });

  it("requires the application review state and rejects an unknown one", () => {
    expect(smeRequestReadSchema.safeParse({ request, salesPeriods: [] }).success).toBe(false);
    expect(
      smeRequestReadSchema.safeParse({ request, salesPeriods: [], state: "not_a_state" }).success
    ).toBe(false);
  });
});
