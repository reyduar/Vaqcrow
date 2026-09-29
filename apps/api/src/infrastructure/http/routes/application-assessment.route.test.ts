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
 * The route owns the exact body key set, the status mapping and the correlation
 * identity; the orchestration lives in the use case. A failed assessment is
 * routed to manual review and the response says so in a label — it never carries
 * an assessment or an approval. A successful assessment is returned advisory and
 * leaves the application's state untouched.
 */

const APPLICATION_ID = parseApplicationId("22222222-2222-4222-8222-222222222222");
const URL = `/application-reviews/${APPLICATION_ID}/assessments`;
const CALLER_CORRELATION_ID = "123e4567-e89b-42d3-a456-426614174000";
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
      recordAssessmentFailureHandoff
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

    const response = await app.inject({ method: "POST", url: URL, payload: { evidence: EVIDENCE } });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toMatchObject({
      outcome: "manual_review",
      manualReviewRequired: true,
      inputsPreserved: true,
      applicationState: "human_review",
      failureCode: "timeout",
      applied: true
    });
    expect(body).not.toHaveProperty("assessment");
    expect(body).not.toHaveProperty("recommendation");
    expect(correlationIdSchema.safeParse(body.correlationId).success).toBe(true);
    expect(body.correlationId).toBe(response.headers["x-correlation-id"]);
    const command = recordAssessmentFailureHandoff.mock.calls[0]?.[0];
    expect(command?.correlationId).toBe(body.correlationId);
  });

  it("returns the advisory assessment without routing when the assessment succeeds", async () => {
    const { repository, recordAssessmentFailureHandoff } = portReturning({});
    app = appWith(
      repository,
      createSimulatedAssessmentProvider({ output: VALID_OUTPUT, now: () => FIXED_NOW })
    );

    const response = await app.inject({ method: "POST", url: URL, payload: { evidence: EVIDENCE } });

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
    ["an invalid application id", "/application-reviews/not-an-id/assessments", { evidence: EVIDENCE }],
    ["a body whose key set drifted", URL, { evidence: EVIDENCE, extra: true }],
    ["an evidence bundle that fails the shared contract", URL, { evidence: { periods: [], findings: [] } }],
    ["an evidence period with an undeclared field", URL, { evidence: { periods: [{ ...JANUARY, note: "x" }], findings: [] } }]
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

    const response = await app.inject({ method: "POST", url: URL, payload: { evidence: EVIDENCE } });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual(expectedBody);
  });

  it("reports any other incompatible state as a 409 with the actual state", async () => {
    const { repository } = portReturning({
      handoff: { ok: false, error: { code: "state_conflict", actualState: "approved" } },
      findById: { ok: true, value: APPROVED }
    });
    app = appWith(repository);

    const response = await app.inject({ method: "POST", url: URL, payload: { evidence: EVIDENCE } });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ code: "state_conflict", actualState: "approved" });
  });

  it("treats an application already in human_review as idempotent success", async () => {
    const { repository } = portReturning({
      handoff: { ok: false, error: { code: "state_conflict", actualState: "human_review" } },
      findById: { ok: true, value: HUMAN_REVIEW }
    });
    app = appWith(repository);

    const response = await app.inject({ method: "POST", url: URL, payload: { evidence: EVIDENCE } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      outcome: "manual_review",
      manualReviewRequired: true,
      applied: false
    });
  });

  it("returns 200 for a same-correlation replay", async () => {
    const { repository } = portReturning({
      handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: false } },
      transition: { ok: true, value: { applied: false, snapshot: HUMAN_REVIEW } }
    });
    app = appWith(repository);

    const response = await app.inject({ method: "POST", url: URL, payload: { evidence: EVIDENCE } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ outcome: "manual_review", applied: false });
  });

  it("ignores a caller-supplied correlation id", async () => {
    const { repository, recordAssessmentFailureHandoff } = portReturning({});
    app = appWith(repository);

    const response = await app.inject({
      method: "POST",
      url: URL,
      headers: { "x-correlation-id": CALLER_CORRELATION_ID },
      payload: { evidence: EVIDENCE }
    });

    const command = recordAssessmentFailureHandoff.mock.calls[0]?.[0];
    expect(command?.correlationId).not.toBe(CALLER_CORRELATION_ID);
    expect(response.headers["x-correlation-id"]).toBe(command?.correlationId);
  });

  it("is not registered when no application assessment is supplied", async () => {
    app = buildApp();

    const response = await app.inject({ method: "POST", url: URL, payload: { evidence: EVIDENCE } });

    expect(response.statusCode).toBe(404);
  });
});
