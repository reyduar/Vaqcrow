import { createSimulatedAssessmentProvider } from "@vaqcrow/ai";
import type { AssessmentProviderPort } from "@vaqcrow/ai";
import { correlationIdSchema, parseApplicationId, parseCorrelationId } from "@vaqcrow/contracts";
import type { AssessmentFailureHandoffRecord } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ApplicationReviewRepositoryPort,
  ApplicationReviewRepositoryResult,
  ApplicationReviewTransitionOutcome,
  AssessmentFailureHandoffRepositoryOutcome
} from "../../../application/ports/application-review-repository-port.js";
import { buildApp } from "../build-app.js";

/**
 * The HTTP surface of an application-scoped assessment (Feature #22, Task #71).
 *
 * The route owns the exact body key set, the status mapping, the correlation
 * identity and the caller-supplied handoff id. A failed assessment is routed to
 * manual review and the response says so in a label — it never carries an
 * assessment or an approval. A successful assessment is returned advisory and
 * leaves the application's state untouched. The caller's `handoffId` is the
 * durable replay identity; `request.id` stays the transport trace and never
 * decides replay.
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

function appWith(
  repository: ApplicationReviewRepositoryPort,
  provider: AssessmentProviderPort = createSimulatedAssessmentProvider({
    output: VALID_OUTPUT,
    failWith: "timeout",
    now: () => FIXED_NOW
  })
): FastifyInstance {
  return buildApp({ applicationAssessment: { repository, provider, timeoutMs: 5_000 } });
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
      payload: { evidence: EVIDENCE, handoffId: HANDOFF_ID }
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

  it("returns the advisory assessment without routing when the assessment succeeds", async () => {
    const { repository, recordAssessmentFailureHandoff } = portReturning({});
    app = appWith(
      repository,
      createSimulatedAssessmentProvider({ output: VALID_OUTPUT, now: () => FIXED_NOW })
    );

    const response = await app.inject({
      method: "POST",
      url: URL,
      payload: { evidence: EVIDENCE, handoffId: HANDOFF_ID }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      outcome: "assessment_available",
      routed: false,
      assessment: { riskBand: "medium", recommendedAction: "human_review" },
      metadata: { model: "simulated-underwriter", source: "simulated", generatedAt: FIXED_NOW }
    });
    expect(recordAssessmentFailureHandoff).not.toHaveBeenCalled();
  });

  it.each([
    [
      "an invalid application id",
      "/application-reviews/not-an-id/assessments",
      { evidence: EVIDENCE, handoffId: HANDOFF_ID }
    ],
    ["a body whose key set drifted", URL, { evidence: EVIDENCE, handoffId: HANDOFF_ID, extra: true }],
    [
      "an evidence bundle that fails the shared contract",
      URL,
      { evidence: { periods: [], findings: [] }, handoffId: HANDOFF_ID }
    ],
    [
      "an evidence period with an undeclared field",
      URL,
      { evidence: { periods: [{ ...JANUARY, note: "x" }], findings: [] }, handoffId: HANDOFF_ID }
    ],
    ["a missing handoff id", URL, { evidence: EVIDENCE }],
    ["a handoff id that is not a uuid", URL, { evidence: EVIDENCE, handoffId: "not-a-uuid" }],
    ["a non-string handoff id", URL, { evidence: EVIDENCE, handoffId: 42 }]
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
      payload: { evidence: EVIDENCE, handoffId: HANDOFF_ID }
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
      payload: { evidence: EVIDENCE, handoffId: HANDOFF_ID }
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
      payload: { evidence: EVIDENCE, handoffId: HANDOFF_ID }
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
      payload: { evidence: EVIDENCE, handoffId: HANDOFF_ID }
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
      payload: { evidence: EVIDENCE, handoffId: HANDOFF_ID }
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
      payload: { evidence: EVIDENCE, handoffId: HANDOFF_ID }
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
      payload: { evidence: EVIDENCE, handoffId: HANDOFF_ID }
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
        payload: { evidence: EVIDENCE, handoffId: HANDOFF_ID }
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
      payload: { evidence: EVIDENCE, handoffId: HANDOFF_ID }
    });

    expect(response.statusCode).toBe(404);
  });
});
