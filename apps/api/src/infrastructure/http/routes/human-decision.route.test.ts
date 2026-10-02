import {
  correlationIdSchema,
  parseCorrelationId,
  parseHumanDecisionCommand,
  parseHumanDecisionRecord
} from "@vaqcrow/contracts";
import type { HumanDecisionRecord } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ApplicationReviewRepositoryPort,
  ApplicationReviewRepositoryResult,
  HumanDecisionRepositoryOutcome
} from "../../../application/ports/application-review-repository-port.js";
import { ADMIN_DISPLAY_NAME, bearer, buildAppAs } from "../test-support/auth.js";

const APPLICATION_ID = "22222222-2222-4222-8222-222222222222";
const CALLER_CORRELATION_ID = "123e4567-e89b-42d3-a456-426614174000";
const body = {
  decisionId: "11111111-1111-4111-8111-111111111111",
  outcome: "approved",
  reason: "Verified synthetic evidence",
  approvedLimitArs: 1_000_000
} as const;
// The recorded actor is the authenticated admin's display name, never a body field (D5).
const ACTOR = ADMIN_DISPLAY_NAME;
const command = parseHumanDecisionCommand({ applicationId: APPLICATION_ID, actor: ACTOR, ...body });
const storedCorrelationId = parseCorrelationId("33333333-3333-4333-8333-333333333333");
const RECORDED_AT = "2026-09-19T12:00:00.000Z";
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
      recordHumanDecision,
      recordAssessmentFailureHandoff: vi.fn(),
      readManualReviewContext: vi.fn(),
      readLatestHumanDecision: vi.fn()
    },
    recordHumanDecision
  };
}

function repositoryReading(
  result: ApplicationReviewRepositoryResult<HumanDecisionRecord>
): {
  repository: ApplicationReviewRepositoryPort;
  readLatestHumanDecision: ReturnType<
    typeof vi.fn<ApplicationReviewRepositoryPort["readLatestHumanDecision"]>
  >;
} {
  const readLatestHumanDecision = vi
    .fn<ApplicationReviewRepositoryPort["readLatestHumanDecision"]>()
    .mockResolvedValue(result);
  return {
    repository: {
      create: vi.fn(),
      findById: vi.fn(),
      transition: vi.fn(),
      recordHumanDecision: vi.fn(),
      recordAssessmentFailureHandoff: vi.fn(),
      readManualReviewContext: vi.fn(),
      readLatestHumanDecision
    },
    readLatestHumanDecision
  };
}

/**
 * A stateful repository double: `recordHumanDecision` stores the record and
 * `readLatestHumanDecision` returns the newest for that application. It is typed
 * as the port itself (no cast), so the round-trip exercises the real POST and
 * GET routes against one shared store rather than two hand-written answers.
 */
function statefulRepository(): ApplicationReviewRepositoryPort {
  let stored: HumanDecisionRecord | undefined;

  const recordHumanDecision = vi
    .fn<ApplicationReviewRepositoryPort["recordHumanDecision"]>()
    .mockImplementation(async (input) => {
      stored = { ...input.command, decidedAt: RECORDED_AT, correlationId: input.correlationId };
      return { ok: true, value: { record: stored, applied: true } };
    });

  const readLatestHumanDecision = vi
    .fn<ApplicationReviewRepositoryPort["readLatestHumanDecision"]>()
    .mockImplementation(async () =>
      stored === undefined
        ? { ok: false, error: { code: "not_found" } }
        : { ok: true, value: stored }
    );

  return {
    create: vi.fn(),
    findById: vi.fn(),
    transition: vi.fn(),
    recordHumanDecision,
    recordAssessmentFailureHandoff: vi.fn(),
    readManualReviewContext: vi.fn(),
    readLatestHumanDecision
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
    app = buildAppAs("ADMIN", { applicationReviewRepository: fake.repository });

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
    ["missing field", `/application-reviews/${APPLICATION_ID}/decisions`, { ...body, reason: undefined }],
    ["a caller-supplied actor", `/application-reviews/${APPLICATION_ID}/decisions`, { ...body, actor: "someone-else" }],
    ["extra field", `/application-reviews/${APPLICATION_ID}/decisions`, { ...body, unexpected: true }]
  ])("rejects %s without calling the repository", async (_name, url, payload) => {
    const fake = repositoryReturning({ ok: true, value: { record: decision, applied: true } });
    app = buildAppAs("ADMIN", { applicationReviewRepository: fake.repository });

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
    app = buildAppAs("ADMIN", { applicationReviewRepository: fake.repository });

    const response = await app.inject({
      method: "POST",
      url: `/application-reviews/${APPLICATION_ID}/decisions`,
      payload: body
    });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual(expectedBody);
  });

  it("records the authenticated admin's display name as the actor", async () => {
    const fake = repositoryReturning({ ok: true, value: { record: decision, applied: true } });
    app = buildAppAs("ADMIN", { applicationReviewRepository: fake.repository });

    await app.inject({
      method: "POST",
      url: `/application-reviews/${APPLICATION_ID}/decisions`,
      headers: bearer("ADMIN"),
      payload: body
    });

    expect(fake.recordHumanDecision.mock.calls[0]?.[0].command.actor).toBe(ADMIN_DISPLAY_NAME);
  });

  it("ignores a caller-supplied correlation ID", async () => {
    const fake = repositoryReturning({ ok: true, value: { record: decision, applied: true } });
    app = buildAppAs("ADMIN", { applicationReviewRepository: fake.repository });

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

describe("GET /application-reviews/:applicationId/decisions", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("returns the application's latest recorded decision", async () => {
    const fake = repositoryReading({ ok: true, value: decision });
    app = buildAppAs("ADMIN", { applicationReviewRepository: fake.repository });

    const response = await app.inject({
      method: "GET",
      url: `/application-reviews/${APPLICATION_ID}/decisions`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ decision });
    expect(fake.readLatestHumanDecision).toHaveBeenCalledOnce();
    expect(fake.readLatestHumanDecision).toHaveBeenCalledWith(APPLICATION_ID);
  });

  it("reports not_found truthfully when no decision is recorded", async () => {
    const fake = repositoryReading({ ok: false, error: { code: "not_found" } });
    app = buildAppAs("ADMIN", { applicationReviewRepository: fake.repository });

    const response = await app.inject({
      method: "GET",
      url: `/application-reviews/${APPLICATION_ID}/decisions`
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "not_found" });
  });

  it("rejects a malformed application id with 400 before calling the repository", async () => {
    const fake = repositoryReading({ ok: true, value: decision });
    app = buildAppAs("ADMIN", { applicationReviewRepository: fake.repository });

    const response = await app.inject({
      method: "GET",
      url: "/application-reviews/not-an-id/decisions"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(fake.readLatestHumanDecision).not.toHaveBeenCalled();
  });

  it("maps unavailable to a sanitized 503", async () => {
    const fake = repositoryReading({ ok: false, error: { code: "unavailable" } });
    app = buildAppAs("ADMIN", { applicationReviewRepository: fake.repository });

    const response = await app.inject({
      method: "GET",
      url: `/application-reviews/${APPLICATION_ID}/decisions`
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });

  it("maps an unexpected state_conflict to 503 unavailable rather than a write-path status", async () => {
    const fake = repositoryReading({
      ok: false,
      error: { code: "state_conflict", actualState: "approved" }
    });
    app = buildAppAs("ADMIN", { applicationReviewRepository: fake.repository });

    const response = await app.inject({
      method: "GET",
      url: `/application-reviews/${APPLICATION_ID}/decisions`
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });

  it("serializes an envelope of exactly the decision key", async () => {
    const fake = repositoryReading({ ok: true, value: decision });
    app = buildAppAs("ADMIN", { applicationReviewRepository: fake.repository });

    const response = await app.inject({
      method: "GET",
      url: `/application-reviews/${APPLICATION_ID}/decisions`
    });

    // The web's parser is strict about the envelope: a stray key is silently
    // dropped there, so the API side pins the wire shape it actually sends.
    expect(Object.keys(response.json())).toEqual(["decision"]);
  });

  it("re-parses through the shared contract with every field the web consumes", async () => {
    const fake = repositoryReading({ ok: true, value: decision });
    app = buildAppAs("ADMIN", { applicationReviewRepository: fake.repository });

    const response = await app.inject({
      method: "GET",
      url: `/application-reviews/${APPLICATION_ID}/decisions`
    });
    const reparsed = parseHumanDecisionRecord(response.json().decision);

    expect(reparsed).toEqual(decision);
    // Every field present and none added: a dropped or coerced field would let
    // the web render a decision the API never recorded.
    expect(reparsed).toEqual({
      decisionId: decision.decisionId,
      applicationId: APPLICATION_ID,
      outcome: "approved",
      actor: ACTOR,
      reason: body.reason,
      approvedLimitArs: body.approvedLimitArs,
      decidedAt: decision.decidedAt,
      correlationId: storedCorrelationId
    });
  });

  it("keeps a null approved limit null on the wire", async () => {
    const changesRequested = parseHumanDecisionRecord({
      decisionId: "44444444-4444-4444-8444-444444444444",
      applicationId: APPLICATION_ID,
      outcome: "changes_requested",
      actor: ACTOR,
      reason: body.reason,
      approvedLimitArs: null,
      decidedAt: RECORDED_AT,
      correlationId: storedCorrelationId
    });
    const fake = repositoryReading({ ok: true, value: changesRequested });
    app = buildAppAs("ADMIN", { applicationReviewRepository: fake.repository });

    const response = await app.inject({
      method: "GET",
      url: `/application-reviews/${APPLICATION_ID}/decisions`
    });
    const reparsed = parseHumanDecisionRecord(response.json().decision);

    // The web omits the limit only because it is null; a coerced value would
    // silently invent an approval the reviewer never made.
    expect(response.json().decision.approvedLimitArs).toBeNull();
    expect(reparsed.approvedLimitArs).toBeNull();
  });

  it("round-trips a decision through the real POST and GET routes", async () => {
    app = buildAppAs("ADMIN", { applicationReviewRepository: statefulRepository() });

    const write = await app.inject({
      method: "POST",
      url: `/application-reviews/${APPLICATION_ID}/decisions`,
      payload: body
    });
    expect(write.statusCode).toBe(201);

    const read = await app.inject({
      method: "GET",
      url: `/application-reviews/${APPLICATION_ID}/decisions`
    });

    expect(read.statusCode).toBe(200);
    expect(parseHumanDecisionRecord(read.json().decision)).toEqual(
      parseHumanDecisionRecord(write.json().decision)
    );
  });

  it("keeps an application with no recorded decision a truthful not_found, never an empty success", async () => {
    app = buildAppAs("ADMIN", { applicationReviewRepository: statefulRepository() });

    const response = await app.inject({
      method: "GET",
      url: `/application-reviews/${APPLICATION_ID}/decisions`
    });

    // An unknown application must not read as a successful but empty result.
    expect(response.statusCode).toBe(404);
    expect(Object.keys(response.json())).toEqual(["code"]);
    expect(response.json()).toEqual({ code: "not_found" });
  });

  it("sanitizes an unavailable read to a 503 that leaks no message, details or hint", async () => {
    const fake = repositoryReading({ ok: false, error: { code: "unavailable" } });
    app = buildAppAs("ADMIN", { applicationReviewRepository: fake.repository });

    const response = await app.inject({
      method: "GET",
      url: `/application-reviews/${APPLICATION_ID}/decisions`
    });
    const responseBody = response.json();

    expect(response.statusCode).toBe(503);
    expect(Object.keys(responseBody)).toEqual(["code"]);
    // Only the sanitized code crosses the wire; the repository's raw error text
    // must never reach the caller.
    expect(responseBody).not.toHaveProperty("message");
    expect(responseBody).not.toHaveProperty("details");
    expect(responseBody).not.toHaveProperty("hint");
  });
});
