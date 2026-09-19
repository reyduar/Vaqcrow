import {
  correlationIdSchema,
  parseCorrelationId,
  parseHumanDecisionCommand,
  parseHumanDecisionRecord
} from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ApplicationReviewRepositoryPort,
  ApplicationReviewRepositoryResult,
  HumanDecisionRepositoryOutcome
} from "../../../application/ports/application-review-repository-port.js";
import { buildApp } from "../build-app.js";

const APPLICATION_ID = "22222222-2222-4222-8222-222222222222";
const CALLER_CORRELATION_ID = "123e4567-e89b-42d3-a456-426614174000";
const body = {
  decisionId: "11111111-1111-4111-8111-111111111111",
  outcome: "approved",
  actor: "reviewer@example.test",
  reason: "Verified synthetic evidence",
  approvedLimitArs: 1_000_000
} as const;
const command = parseHumanDecisionCommand({ applicationId: APPLICATION_ID, ...body });
const storedCorrelationId = parseCorrelationId("33333333-3333-4333-8333-333333333333");
const decision = parseHumanDecisionRecord({
  ...command,
  decidedAt: "2026-09-19T12:00:00.000Z",
  correlationId: storedCorrelationId
});

function repositoryReturning(
  result: ApplicationReviewRepositoryResult<HumanDecisionRepositoryOutcome>
): {
  repository: ApplicationReviewRepositoryPort;
  recordHumanDecision: ReturnType<typeof vi.fn<ApplicationReviewRepositoryPort["recordHumanDecision"]>>;
} {
  const recordHumanDecision = vi
    .fn<ApplicationReviewRepositoryPort["recordHumanDecision"]>()
    .mockResolvedValue(result);
  return {
    repository: {
      create: vi.fn(),
      findById: vi.fn(),
      transition: vi.fn(),
      recordHumanDecision
    },
    recordHumanDecision
  };
}

describe("POST /application-reviews/:applicationId/decisions", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it.each([
    [true, 201],
    [false, 200]
  ] as const)("returns applied=%s with status %s", async (applied, status) => {
    const fake = repositoryReturning({ ok: true, value: { record: decision, applied } });
    app = buildApp({ applicationReviewRepository: fake.repository });

    const response = await app.inject({
      method: "POST",
      url: `/application-reviews/${APPLICATION_ID}/decisions`,
      payload: body
    });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual({ applied, decision });
    expect(fake.recordHumanDecision).toHaveBeenCalledOnce();
    const input = fake.recordHumanDecision.mock.calls[0]?.[0];
    expect(input?.command).toEqual(command);
    expect(correlationIdSchema.safeParse(input?.correlationId).success).toBe(true);
    expect(response.headers["x-correlation-id"]).toBe(input?.correlationId);
  });

  it.each([
    ["invalid path", "/application-reviews/not-an-id/decisions", body],
    ["invalid body", `/application-reviews/${APPLICATION_ID}/decisions`, { ...body, reason: "" }],
    ["missing field", `/application-reviews/${APPLICATION_ID}/decisions`, { ...body, actor: undefined }],
    ["extra field", `/application-reviews/${APPLICATION_ID}/decisions`, { ...body, unexpected: true }]
  ])("rejects %s without calling the repository", async (_name, url, payload) => {
    const fake = repositoryReturning({ ok: true, value: { record: decision, applied: true } });
    app = buildApp({ applicationReviewRepository: fake.repository });

    const response = await app.inject({ method: "POST", url, payload });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(fake.recordHumanDecision).not.toHaveBeenCalled();
  });

  it.each([
    [{ code: "not_found" } as const, 404, { code: "not_found" }],
    [
      { code: "state_conflict", actualState: "approved" } as const,
      409,
      { code: "state_conflict", actualState: "approved" }
    ],
    [{ code: "idempotency_conflict" } as const, 409, { code: "idempotency_conflict" }],
    [{ code: "unavailable" } as const, 503, { code: "unavailable" }]
  ])("maps %s to status %s", async (error, status, expectedBody) => {
    const fake = repositoryReturning({ ok: false, error });
    app = buildApp({ applicationReviewRepository: fake.repository });

    const response = await app.inject({
      method: "POST",
      url: `/application-reviews/${APPLICATION_ID}/decisions`,
      payload: body
    });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual(expectedBody);
  });

  it("ignores a caller-supplied correlation ID", async () => {
    const fake = repositoryReturning({ ok: true, value: { record: decision, applied: true } });
    app = buildApp({ applicationReviewRepository: fake.repository });

    const response = await app.inject({
      method: "POST",
      url: `/application-reviews/${APPLICATION_ID}/decisions`,
      headers: { "x-correlation-id": CALLER_CORRELATION_ID },
      payload: body
    });
    const generatedCorrelationId = fake.recordHumanDecision.mock.calls[0]?.[0].correlationId;

    expect(generatedCorrelationId).not.toBe(CALLER_CORRELATION_ID);
    expect(response.headers["x-correlation-id"]).toBe(generatedCorrelationId);
  });
});
