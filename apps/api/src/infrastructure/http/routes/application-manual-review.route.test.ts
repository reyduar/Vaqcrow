import { parseApplicationId } from "@vaqcrow/contracts";
import type { ApplicationManualReviewContext } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ApplicationReviewRepositoryPort,
  ApplicationReviewRepositoryResult
} from "../../../application/ports/application-review-repository-port.js";
import { buildApp } from "../build-app.js";

/**
 * The read surface of the manual-review context (Feature #22, Task #71).
 *
 * The route is application-scoped and read-only: it returns exactly the
 * persisted context or a truthful `not_found` when no handoff exists. It never
 * fabricates empty-but-successful content and never adds provider diagnostics.
 */

const APPLICATION_ID = parseApplicationId("22222222-2222-4222-8222-222222222222");
const URL = `/application-reviews/${APPLICATION_ID}/manual-review`;
const RECORDED_AT = "2026-09-28T12:05:00.000Z";

const JANUARY = {
  period: "2026-01",
  amountArs: 1_200_000,
  status: "reported",
  evidenceRef: "sales:2026-01",
  simuladoLabel: "SIMULADO"
} as const;

const EVIDENCE = { periods: [JANUARY], findings: [] };

const CONTEXT: ApplicationManualReviewContext = {
  applicationId: APPLICATION_ID,
  applicationState: "human_review",
  failureCode: "timeout",
  evidence: EVIDENCE,
  providerProvenance: {
    model: "simulated-underwriter",
    promptVersion: "prompt-v1",
    generatedAt: RECORDED_AT,
    source: "simulated"
  },
  recordedAt: RECORDED_AT
};

type ReadResult = ApplicationReviewRepositoryResult<ApplicationManualReviewContext>;

function repositoryDouble(read: ReadResult): {
  repository: ApplicationReviewRepositoryPort;
  readManualReviewContext: ReturnType<typeof vi.fn>;
} {
  const readManualReviewContext = vi
    .fn<ApplicationReviewRepositoryPort["readManualReviewContext"]>()
    .mockResolvedValue(read);

  return {
    repository: {
      create: vi.fn(),
      findById: vi.fn(),
      transition: vi.fn(),
      recordHumanDecision: vi.fn(),
      recordAssessmentFailureHandoff: vi.fn(),
      readManualReviewContext,
      readLatestHumanDecision: vi.fn()
    },
    readManualReviewContext
  };
}

describe("GET /application-reviews/:applicationId/manual-review", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("returns the persisted manual-review context for the application", async () => {
    const { repository } = repositoryDouble({ ok: true, value: CONTEXT });
    app = buildApp({ applicationReviewRepository: repository });

    const response = await app.inject({ method: "GET", url: URL });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(CONTEXT);
    // A simulated source stays labelled so the screen can never present it as real.
    expect(response.json().providerProvenance.source).toBe("simulated");
  });

  it("reports not_found truthfully when no handoff exists for the application", async () => {
    const { repository } = repositoryDouble({ ok: false, error: { code: "not_found" } });
    app = buildApp({ applicationReviewRepository: repository });

    const response = await app.inject({ method: "GET", url: URL });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "not_found" });
  });

  it("maps a repository failure to a sanitized 503 unavailable", async () => {
    const { repository } = repositoryDouble({ ok: false, error: { code: "unavailable" } });
    app = buildApp({ applicationReviewRepository: repository });

    const response = await app.inject({ method: "GET", url: URL });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });

  it("rejects an invalid application id with 400 before reading the repository", async () => {
    const { repository, readManualReviewContext } = repositoryDouble({ ok: true, value: CONTEXT });
    app = buildApp({ applicationReviewRepository: repository });

    const response = await app.inject({
      method: "GET",
      url: "/application-reviews/not-an-id/manual-review"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(readManualReviewContext).not.toHaveBeenCalled();
  });

  it("is not registered when no application review repository is supplied", async () => {
    app = buildApp();

    const response = await app.inject({ method: "GET", url: URL });

    expect(response.statusCode).toBe(404);
  });
});
