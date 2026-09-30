import { createSimulatedAssessmentProvider } from "@vaqcrow/ai";
import type { AssessmentProviderPort } from "@vaqcrow/ai";
import { correlationIdSchema, parseApplicationId, parseCorrelationId } from "@vaqcrow/contracts";
import { applicationAssessmentOutcomeSchema, applicationAssessmentReadSchema } from "@vaqcrow/contracts";
import type { AssessmentFailureHandoffRecord, SmeRequest } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ApplicationReviewRepositoryPort,
  ApplicationReviewRepositoryResult,
  ApplicationReviewTransitionOutcome,
  AssessmentFailureHandoffRepositoryOutcome
} from "../../../application/ports/application-review-repository-port.js";
import type {
  ApplicationAssessmentRepositoryPort,
  ApplicationAssessmentRepositoryResult
} from "../../../application/ports/application-assessment-repository-port.js";
import type { SalesDataProviderPort, SalesDataProviderResult } from "../../../application/ports/sales-data-provider-port.js";
import type { SmeRequestRepositoryPort } from "../../../application/ports/sme-request-repository-port.js";
import { buildApp } from "../build-app.js";

/**
 * The HTTP surface of an application-scoped assessment (Feature #22 Task #71,
 * Feature #30 Task #95 / T3a).
 *
 * The route owns the exact body key set (`{ handoffId }` only: the evidence is
 * derived server-side, a client can no longer supply it), the status mapping,
 * the correlation identity and the caller-supplied handoff id. A failed
 * assessment is routed to manual review and the response says so in a label — it
 * never carries an assessment or an approval. A successful assessment is
 * persisted with the transition to `human_review` (201 applied / 200 replay).
 * The caller's `handoffId` is the durable replay identity; `request.id` stays
 * the transport trace and never decides replay.
 */

const APPLICATION_ID = parseApplicationId("22222222-2222-4222-8222-222222222222");
const URL = `/application-reviews/${APPLICATION_ID}/assessments`;
const CALLER_CORRELATION_ID = "123e4567-e89b-42d3-a456-426614174000";
const HANDOFF_ID = "44444444-4444-4444-8444-444444444444";
const FIXED_NOW = "2026-09-22T12:00:00.000Z";

const JANUARY = {
  period: "2026-01",
  amountArs: 1_200_000,
  status: "reported",
  evidenceRef: "sales:2026-01",
  simuladoLabel: "SIMULADO"
} as const;

const EVIDENCE = { periods: [JANUARY], findings: [] };

const VALID_OUTPUT = {
  assessmentId: "asm_demo_001",
  riskBand: "medium",
  confidence: 0.72,
  reasons: [{ claim: "Las ventas son estacionales", evidenceRefs: ["sales:2026-01"] }],
  anomalies: [],
  missingData: [],
  recommendedAction: "human_review",
  questions: []
};

const HANDOFF_RECORD: AssessmentFailureHandoffRecord = {
  applicationId: APPLICATION_ID,
  correlationId: parseCorrelationId("33333333-3333-4333-8333-333333333333"),
  failureCode: "timeout",
  evidence: EVIDENCE
};

const HUMAN_REVIEW = { applicationId: APPLICATION_ID, state: "human_review" } as const;
const APPROVED = { applicationId: APPLICATION_ID, state: "approved" } as const;

type HandoffResult = ApplicationReviewRepositoryResult<AssessmentFailureHandoffRepositoryOutcome>;
type TransitionResult = ApplicationReviewRepositoryResult<ApplicationReviewTransitionOutcome>;

function portReturning(overrides: {
  handoff?: HandoffResult;
  transition?: TransitionResult;
  findById?: ApplicationReviewRepositoryResult<{ applicationId: typeof APPLICATION_ID; state: "human_review" | "approved" }>;
}): { repository: ApplicationReviewRepositoryPort; recordAssessmentFailureHandoff: ReturnType<typeof vi.fn> } {
  const recordAssessmentFailureHandoff = vi
    .fn<ApplicationReviewRepositoryPort["recordAssessmentFailureHandoff"]>()
    .mockResolvedValue(overrides.handoff ?? { ok: true, value: { record: HANDOFF_RECORD, applied: true } });
  const transition = vi
    .fn<ApplicationReviewRepositoryPort["transition"]>()
    .mockResolvedValue(overrides.transition ?? { ok: true, value: { applied: true, snapshot: HUMAN_REVIEW } });

  return {
    repository: {
      create: vi.fn(),
      findById: vi
        .fn<ApplicationReviewRepositoryPort["findById"]>()
        .mockResolvedValue(overrides.findById ?? { ok: true, value: HUMAN_REVIEW }),
      transition,
      recordHumanDecision: vi.fn(),
      recordAssessmentFailureHandoff,
      readManualReviewContext: vi.fn(),
      readLatestHumanDecision: vi.fn()
    },
    recordAssessmentFailureHandoff
  };
}

const SME_REQUEST: SmeRequest = {
  smeReference: "sme:SYN-PH-0001",
  declaredTotalArs: 15_000_000,
  periodStart: "2026-01",
  periodEnd: "2026-08",
  simuladoLabel: "SIMULADO"
};

const RECORDED_AT = "2026-09-30T12:00:01.000Z";

interface Collaborators {
  readonly smeRequest?: Awaited<ReturnType<SmeRequestRepositoryPort["findByApplicationId"]>>;
  readonly sales?: SalesDataProviderResult<readonly (typeof JANUARY)[]>;
  readonly record?: ApplicationAssessmentRepositoryResult<{
    record: { assessment: typeof VALID_OUTPUT; metadata: object; recordedAt: string };
    applied: boolean;
  }>;
  readonly find?: ApplicationAssessmentRepositoryResult<{
    assessment: typeof VALID_OUTPUT;
    metadata: object;
    recordedAt: string;
  }>;
}

function collaboratorsFor(overrides: Collaborators = {}) {
  const findByApplicationId = vi
    .fn<SmeRequestRepositoryPort["findByApplicationId"]>()
    .mockResolvedValue(
      overrides.smeRequest ?? { ok: true, value: { applicationId: APPLICATION_ID, request: SME_REQUEST } }
    );
  const getPeriods = vi
    .fn<SalesDataProviderPort["getPeriods"]>()
    .mockResolvedValue(overrides.sales ?? { ok: true, value: [JANUARY] });
  const record = vi.fn<ApplicationAssessmentRepositoryPort["record"]>().mockImplementation(async (command) =>
    (overrides.record as never) ?? {
      ok: true,
      value: {
        record: { assessment: command.assessment, metadata: command.metadata, recordedAt: RECORDED_AT },
        applied: true
      }
    }
  );
  const find = vi
    .fn<ApplicationAssessmentRepositoryPort["findByApplicationId"]>()
    .mockResolvedValue((overrides.find as never) ?? { ok: false, error: { code: "not_found" } });

  return {
    record,
    find,
    getPeriods,
    findByApplicationId,
    dependencies: {
      assessments: { record, findByApplicationId: find },
      smeRequests: { findByApplicationId },
      salesData: { getPeriods }
    }
  };
}

function appWith(
  repository: ApplicationReviewRepositoryPort,
  provider: AssessmentProviderPort = createSimulatedAssessmentProvider({
    output: VALID_OUTPUT,
    failWith: "timeout",
    now: () => FIXED_NOW
  }),
  collaborators: ReturnType<typeof collaboratorsFor> = collaboratorsFor()
): FastifyInstance {
  return buildApp({
    applicationAssessment: { repository, provider, timeoutMs: 5_000, ...collaborators.dependencies }
  });
}

describe("POST /application-reviews/:applicationId/assessments", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("routes a failed assessment to manual review with a truthful label", async () => {
    const { repository, recordAssessmentFailureHandoff } = portReturning({});
    app = appWith(repository);

    const response = await app.inject({
      method: "POST",
      url: URL,
      payload: { handoffId: HANDOFF_ID }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toMatchObject({
      outcome: "manual_review",
      manualReviewRequired: true,
      inputsPreserved: true,
      applicationState: "human_review",
      failureCode: "timeout",
      handoff: "persisted",
      applied: true
    });
    expect(body).not.toHaveProperty("assessment");
    expect(body).not.toHaveProperty("recommendation");
    expect(correlationIdSchema.safeParse(body.correlationId).success).toBe(true);
    expect(body.correlationId).toBe(response.headers["x-correlation-id"]);
    const command = recordAssessmentFailureHandoff.mock.calls[0]?.[0];
    // The durable handoff correlation is the caller's handoff id, not request.id.
    expect(command?.correlationId).toBe(HANDOFF_ID);
  });

  it("persists a successful assessment, moves to human_review and answers 201 with the recorded outcome", async () => {
    const { repository, recordAssessmentFailureHandoff } = portReturning({});
    const collaborators = collaboratorsFor();
    app = appWith(
      repository,
      createSimulatedAssessmentProvider({ output: VALID_OUTPUT, now: () => FIXED_NOW }),
      collaborators
    );

    const response = await app.inject({ method: "POST", url: URL, payload: { handoffId: HANDOFF_ID } });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toMatchObject({
      outcome: "assessment_recorded",
      applicationState: "human_review",
      applied: true,
      assessment: { riskBand: "medium", recommendedAction: "human_review" },
      metadata: { model: "simulated-underwriter", source: "simulated", generatedAt: FIXED_NOW },
      recordedAt: RECORDED_AT
    });
    // The wire shape is the portable contract the web consumes.
    expect(applicationAssessmentOutcomeSchema.safeParse(body).success).toBe(true);
    expect(body.correlationId).toBe(response.headers["x-correlation-id"]);
    expect(collaborators.record.mock.calls[0]?.[0].attemptId).toBe(HANDOFF_ID);
    expect(recordAssessmentFailureHandoff).not.toHaveBeenCalled();
  });

  it("derives the evidence from the persisted request: the client cannot supply it", async () => {
    const { repository } = portReturning({});
    const collaborators = collaboratorsFor();
    app = appWith(repository, undefined, collaborators);

    await app.inject({ method: "POST", url: URL, payload: { handoffId: HANDOFF_ID } });

    expect(collaborators.findByApplicationId).toHaveBeenCalledWith(APPLICATION_ID);
    expect(collaborators.getPeriods).toHaveBeenCalledWith("sme:SYN-PH-0001");
  });

  it("answers 200 for a same-attempt success replay, with the stored record", async () => {
    const { repository } = portReturning({});
    const collaborators = collaboratorsFor({
      record: {
        ok: true,
        value: {
          record: {
            assessment: { ...VALID_OUTPUT, assessmentId: "asm_stored" },
            metadata: { model: "stored", promptVersion: "v0", generatedAt: FIXED_NOW, source: "simulated" },
            recordedAt: RECORDED_AT
          },
          applied: false
        }
      }
    });
    app = appWith(repository, createSimulatedAssessmentProvider({ output: VALID_OUTPUT, now: () => FIXED_NOW }), collaborators);

    const response = await app.inject({ method: "POST", url: URL, payload: { handoffId: HANDOFF_ID } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      outcome: "assessment_recorded",
      applied: false,
      assessment: { assessmentId: "asm_stored" }
    });
  });

  it.each([
    [{ ok: false, error: { code: "attempt_conflict" } } as const, 409, { code: "correlation_conflict" }],
    [
      { ok: false, error: { code: "state_conflict", actualState: "approved" } } as const,
      409,
      { code: "state_conflict", actualState: "approved" }
    ],
    [{ ok: false, error: { code: "not_found" } } as const, 404, { code: "not_found" }],
    [{ ok: false, error: { code: "unavailable" } } as const, 503, { code: "unavailable" }]
  ])("maps a success-path persistence failure %#", async (record, status, expectedBody) => {
    const { repository } = portReturning({});
    app = appWith(
      repository,
      createSimulatedAssessmentProvider({ output: VALID_OUTPUT, now: () => FIXED_NOW }),
      collaboratorsFor({ record })
    );

    const response = await app.inject({ method: "POST", url: URL, payload: { handoffId: HANDOFF_ID } });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual(expectedBody);
  });

  it("answers 404 when the application has no persisted request", async () => {
    const { repository } = portReturning({});
    app = appWith(repository, undefined, collaboratorsFor({ smeRequest: { ok: false, error: { code: "not_found" } } }));

    const response = await app.inject({ method: "POST", url: URL, payload: { handoffId: HANDOFF_ID } });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "not_found" });
  });

  it("answers 409 sales_evidence_missing when the request has no sales periods, leaving the application untouched", async () => {
    const { repository, recordAssessmentFailureHandoff } = portReturning({});
    const collaborators = collaboratorsFor({ sales: { ok: true, value: [] } });
    app = appWith(repository, createSimulatedAssessmentProvider({ output: VALID_OUTPUT, now: () => FIXED_NOW }), collaborators);

    const response = await app.inject({ method: "POST", url: URL, payload: { handoffId: HANDOFF_ID } });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ code: "sales_evidence_missing" });
    expect(collaborators.record).not.toHaveBeenCalled();
    expect(recordAssessmentFailureHandoff).not.toHaveBeenCalled();
  });

  it.each([
    [
      "an invalid application id",
      "/application-reviews/not-an-id/assessments",
      { handoffId: HANDOFF_ID }
    ],
    ["a body whose key set drifted", URL, { evidence: EVIDENCE, handoffId: HANDOFF_ID, extra: true }],
    ["a client-supplied evidence bundle", URL, { evidence: EVIDENCE, handoffId: HANDOFF_ID }],
    ["an empty body object", URL, {}],
    ["a missing handoff id", URL, { evidence: EVIDENCE }],
    ["a handoff id that is not a uuid", URL, { handoffId: "not-a-uuid" }],
    ["a non-string handoff id", URL, { handoffId: 42 }]
  ])("rejects %s with 400 before calling the repository", async (_name, url, payload) => {
    const { repository, recordAssessmentFailureHandoff } = portReturning({});
    app = appWith(repository);

    const response = await app.inject({ method: "POST", url, payload });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(recordAssessmentFailureHandoff).not.toHaveBeenCalled();
  });

  it.each([
    [{ ok: false, error: { code: "not_found" } } as const, 404, { code: "not_found" }],
    [
      { ok: false, error: { code: "correlation_conflict" } } as const,
      409,
      { code: "correlation_conflict" }
    ],
    [{ ok: false, error: { code: "unavailable" } } as const, 503, { code: "unavailable" }]
  ])("maps a repository failure to status %#", async (handoff, status, expectedBody) => {
    const { repository } = portReturning({ handoff });
    app = appWith(repository);

    const response = await app.inject({
      method: "POST",
      url: URL,
      payload: { handoffId: HANDOFF_ID }
    });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual(expectedBody);
  });

  it("reports any other incompatible state as a 409 with the actual state", async () => {
    const { repository } = portReturning({
      handoff: { ok: false, error: { code: "state_conflict", actualState: "approved" } },
      findById: { ok: true, value: APPROVED }
    });
    app = appWith(repository);

    const response = await app.inject({
      method: "POST",
      url: URL,
      payload: { handoffId: HANDOFF_ID }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ code: "state_conflict", actualState: "approved" });
  });

  it("reports an application already in human_review without a handoff as inputs not preserved", async () => {
    const { repository } = portReturning({
      handoff: { ok: false, error: { code: "state_conflict", actualState: "human_review" } },
      findById: { ok: true, value: HUMAN_REVIEW }
    });
    app = appWith(repository);

    const response = await app.inject({
      method: "POST",
      url: URL,
      payload: { handoffId: HANDOFF_ID }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      outcome: "manual_review",
      manualReviewRequired: true,
      inputsPreserved: false,
      applicationState: "human_review",
      handoff: "absent",
      applied: false
    });
  });

  it("returns 200 for a same-key replay", async () => {
    const { repository } = portReturning({
      handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: false } },
      transition: { ok: true, value: { applied: false, snapshot: HUMAN_REVIEW } }
    });
    app = appWith(repository);

    const response = await app.inject({
      method: "POST",
      url: URL,
      payload: { handoffId: HANDOFF_ID }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      outcome: "manual_review",
      inputsPreserved: true,
      handoff: "replayed",
      applied: false
    });
  });

  it("uses the caller handoff id for replay and keeps request.id as the transport correlation", async () => {
    const { repository, recordAssessmentFailureHandoff } = portReturning({});
    app = appWith(repository);

    const response = await app.inject({
      method: "POST",
      url: URL,
      headers: { "x-correlation-id": CALLER_CORRELATION_ID },
      payload: { handoffId: HANDOFF_ID }
    });

    const command = recordAssessmentFailureHandoff.mock.calls[0]?.[0];
    // The durable replay identity is the caller's handoff id...
    expect(command?.correlationId).toBe(HANDOFF_ID);
    expect(command?.correlationId).not.toBe(CALLER_CORRELATION_ID);
    // ...while the transport correlation stays the generated request id.
    expect(response.json().correlationId).toBe(response.headers["x-correlation-id"]);
    expect(response.json().correlationId).not.toBe(HANDOFF_ID);
  });

  it.each([
    [
      "timeout",
      createSimulatedAssessmentProvider({ output: VALID_OUTPUT, failWith: "timeout", now: () => FIXED_NOW })
    ],
    [
      "provider_unavailable",
      createSimulatedAssessmentProvider({
        output: VALID_OUTPUT,
        failWith: "provider_unavailable",
        now: () => FIXED_NOW
      })
    ],
    [
      "invalid_output",
      createSimulatedAssessmentProvider({
        output: { ...VALID_OUTPUT, confidence: 72 },
        now: () => FIXED_NOW
      })
    ],
    [
      "unknown_evidence_reference",
      createSimulatedAssessmentProvider({
        output: { ...VALID_OUTPUT, reasons: [{ claim: "Inventada", evidenceRefs: ["sales:2025-12"] }] },
        now: () => FIXED_NOW
      })
    ]
  ])("routes a %s failure to 201 manual review with only the sanitized routing keys", async (code, provider) => {
    const { repository } = portReturning({});
    app = appWith(repository, provider);

    const response = await app.inject({
      method: "POST",
      url: URL,
      payload: { handoffId: HANDOFF_ID }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toMatchObject({
      outcome: "manual_review",
      manualReviewRequired: true,
      inputsPreserved: true,
      failureCode: code,
      handoff: "persisted",
      applied: true
    });
    expect(body).not.toHaveProperty("assessment");
    expect(body).not.toHaveProperty("recommendation");
    expect(Object.keys(body).sort()).toEqual([
      "applicationState",
      "applied",
      "correlationId",
      "failureCode",
      "handoff",
      "inputsPreserved",
      "manualReviewRequired",
      "outcome"
    ]);
  });

  it("returns 201 when a replayed handoff completes the pending transition (crash recovery)", async () => {
    const { repository } = portReturning({
      handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: false } },
      transition: { ok: true, value: { applied: true, snapshot: HUMAN_REVIEW } }
    });
    app = appWith(repository);

    const response = await app.inject({
      method: "POST",
      url: URL,
      payload: { handoffId: HANDOFF_ID }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      outcome: "manual_review",
      handoff: "replayed",
      inputsPreserved: true,
      applied: true
    });
  });

  it("is deterministic: the same request yields the same sanitized body across runs", async () => {
    const once = async () => {
      const { repository } = portReturning({});
      const runApp = appWith(repository);
      const response = await runApp.inject({
        method: "POST",
        url: URL,
        payload: { handoffId: HANDOFF_ID }
      });
      await runApp.close();
      // The transport id is generated per request by design; everything the
      // response actually reports is otherwise stable.
      const body = response.json() as Record<string, unknown>;
      delete body["correlationId"];
      return body;
    };

    expect(await once()).toEqual(await once());
  });

  it("is not registered when no application assessment is supplied", async () => {
    app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: URL,
      payload: { handoffId: HANDOFF_ID }
    });

    expect(response.statusCode).toBe(404);
  });
});

describe("GET /application-reviews/:applicationId/assessment", () => {
  const GET_URL = `/application-reviews/${APPLICATION_ID}/assessment`;
  let getApp: FastifyInstance | undefined;

  afterEach(async () => {
    await getApp?.close();
    getApp = undefined;
  });

  it("returns the persisted assessment, its metadata and when it was recorded", async () => {
    const { repository } = portReturning({});
    const collaborators = collaboratorsFor({
      find: {
        ok: true,
        value: {
          assessment: VALID_OUTPUT,
          metadata: { model: "demo", promptVersion: "v1", generatedAt: FIXED_NOW, source: "simulated" },
          recordedAt: RECORDED_AT
        }
      }
    });
    getApp = appWith(repository, undefined, collaborators);

    const response = await getApp.inject({ method: "GET", url: GET_URL });

    expect(response.statusCode).toBe(200);
    expect(applicationAssessmentReadSchema.parse(response.json())).toMatchObject({
      assessment: { assessmentId: "asm_demo_001" },
      metadata: { source: "simulated" },
      recordedAt: RECORDED_AT
    });
    expect(collaborators.find).toHaveBeenCalledWith(APPLICATION_ID);
  });

  it("answers 404 when no assessment was recorded", async () => {
    const { repository } = portReturning({});
    getApp = appWith(repository);

    const response = await getApp.inject({ method: "GET", url: GET_URL });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "not_found" });
  });

  it("answers 400 for a malformed application id and 503 when persistence is unavailable", async () => {
    const { repository } = portReturning({});
    getApp = appWith(repository, undefined, collaboratorsFor({ find: { ok: false, error: { code: "unavailable" } } }));

    const malformed = await getApp.inject({ method: "GET", url: "/application-reviews/not-an-id/assessment" });
    const unavailable = await getApp.inject({ method: "GET", url: GET_URL });

    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toEqual({ code: "invalid_request" });
    expect(unavailable.statusCode).toBe(503);
    expect(unavailable.json()).toEqual({ code: "unavailable" });
  });
});

describe("assessment contract parity with the AI package", () => {
  it("a real runAssessment result satisfies the portable contract schema", async () => {
    const { runAssessment } = await import("@vaqcrow/ai");
    const result = await runAssessment(
      createSimulatedAssessmentProvider({ output: VALID_OUTPUT, now: () => FIXED_NOW }),
      { evidence: EVIDENCE, timeoutMs: 1_000 }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      applicationAssessmentReadSchema.safeParse({
        assessment: result.value.assessment,
        metadata: result.value.metadata,
        recordedAt: RECORDED_AT
      }).success
    ).toBe(true);
  });
});
