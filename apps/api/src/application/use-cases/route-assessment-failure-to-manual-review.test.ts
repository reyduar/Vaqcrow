import { createSimulatedAssessmentProvider } from "@vaqcrow/ai";
import type { AssessmentEvidenceBundle, AssessmentProviderPort } from "@vaqcrow/ai";
import { parseApplicationId, parseAssessmentHandoffId, parseCorrelationId } from "@vaqcrow/contracts";
import type {
  ApplicationReviewSnapshot,
  AssessmentFailureHandoffRecord
} from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import type {
  ApplicationReviewRepositoryPort,
  ApplicationReviewRepositoryResult,
  ApplicationReviewTransitionOutcome,
  AssessmentFailureHandoffRepositoryOutcome
} from "../ports/application-review-repository-port.js";
import { routeAssessmentFailureToManualReview } from "./route-assessment-failure-to-manual-review.js";

/**
 * Focused behaviour for the application-scoped failure routing (Feature #22,
 * Task #71). The route/use case must persist the sanitized handoff before it
 * transitions `awaiting_assessment -> human_review`, must never turn a failure
 * into an assessment or an approval, and must resolve replay, competing
 * correlation, unknown application and incompatible state explicitly.
 *
 * The provider is the AI package's own deterministic simulated implementation,
 * so every case runs with no network and no credential.
 */

const APPLICATION_ID = parseApplicationId("22222222-2222-4222-8222-222222222222");
const CORRELATION_ID = parseCorrelationId("33333333-3333-4333-8333-333333333333");
const HANDOFF_ID = parseAssessmentHandoffId("44444444-4444-4444-8444-444444444444");
const FIXED_NOW = "2026-09-22T12:00:00.000Z";

const JANUARY = {
  period: "2026-01",
  amountArs: 1_200_000,
  status: "reported",
  evidenceRef: "sales:2026-01",
  simuladoLabel: "SIMULADO"
} as const;

const JUNE = {
  period: "2026-06",
  amountArs: 3_400_000,
  status: "anomalous",
  evidenceRef: "sales:2026-06",
  simuladoLabel: "SIMULADO"
} as const;

const EVIDENCE: AssessmentEvidenceBundle = { periods: [JANUARY, JUNE], findings: [] };

const VALID_OUTPUT = {
  assessmentId: "asm_demo_001",
  riskBand: "medium",
  confidence: 0.72,
  reasons: [{ claim: "Las ventas son estacionales", evidenceRefs: ["sales:2026-01"] }],
  anomalies: [{ type: "outlier", evidenceRef: "sales:2026-06", severity: "review" }],
  missingData: [],
  recommendedAction: "human_review",
  questions: []
} as const;

const HUMAN_REVIEW: ApplicationReviewSnapshot = { applicationId: APPLICATION_ID, state: "human_review" };

const HANDOFF_RECORD: AssessmentFailureHandoffRecord = {
  applicationId: APPLICATION_ID,
  correlationId: CORRELATION_ID,
  failureCode: "timeout",
  evidence: EVIDENCE
};

type RoutingRepository = Pick<
  ApplicationReviewRepositoryPort,
  "findById" | "recordAssessmentFailureHandoff" | "transition"
>;

function providerWith(
  output: unknown = VALID_OUTPUT,
  failWith?: "timeout" | "provider_unavailable",
  delayMs?: number
): AssessmentProviderPort {
  return createSimulatedAssessmentProvider({
    output,
    ...(failWith === undefined ? {} : { failWith }),
    ...(delayMs === undefined ? {} : { delayMs }),
    now: () => FIXED_NOW
  });
}

function routingRepository(overrides: {
  handoff: ApplicationReviewRepositoryResult<AssessmentFailureHandoffRepositoryOutcome>;
  transition?: ApplicationReviewRepositoryResult<ApplicationReviewTransitionOutcome>;
  findById?: ApplicationReviewRepositoryResult<ApplicationReviewSnapshot>;
}): {
  repository: RoutingRepository;
  recordAssessmentFailureHandoff: ReturnType<typeof vi.fn<RoutingRepository["recordAssessmentFailureHandoff"]>>;
  transition: ReturnType<typeof vi.fn<RoutingRepository["transition"]>>;
  findById: ReturnType<typeof vi.fn<RoutingRepository["findById"]>>;
} {
  const recordAssessmentFailureHandoff = vi
    .fn<RoutingRepository["recordAssessmentFailureHandoff"]>()
    .mockResolvedValue(overrides.handoff);
  const transition = vi
    .fn<RoutingRepository["transition"]>()
    .mockResolvedValue(
      overrides.transition ?? { ok: true, value: { applied: true, snapshot: HUMAN_REVIEW } }
    );
  const findById = vi
    .fn<RoutingRepository["findById"]>()
    .mockResolvedValue(overrides.findById ?? { ok: true, value: HUMAN_REVIEW });

  return {
    repository: { recordAssessmentFailureHandoff, transition, findById },
    recordAssessmentFailureHandoff,
    transition,
    findById
  };
}

function dependencies(
  overrides: Parameters<typeof routingRepository>[0],
  provider: AssessmentProviderPort = providerWith(VALID_OUTPUT, "timeout"),
  timeoutMs = 5_000
) {
  const fake = routingRepository(overrides);

  return {
    ...fake,
    dependencies: { repository: fake.repository, provider, timeoutMs }
  };
}

const input = {
  applicationId: APPLICATION_ID,
  evidence: EVIDENCE,
  handoffId: HANDOFF_ID,
  correlationId: CORRELATION_ID
};

describe("routeAssessmentFailureToManualReview", () => {
  it("persists the sanitized handoff first, then transitions, and labels manual review", async () => {
    const fake = dependencies({
      handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } }
    });

    const result = await routeAssessmentFailureToManualReview(fake.dependencies, input);

    expect(result).toEqual({
      ok: true,
      value: {
        outcome: "manual_review",
        manualReviewRequired: true,
        inputsPreserved: true,
        applicationState: "human_review",
        failureCode: "timeout",
        handoff: "persisted",
        correlationId: CORRELATION_ID,
        applied: true
      }
    });
    expect(fake.recordAssessmentFailureHandoff).toHaveBeenCalledWith({
      applicationId: APPLICATION_ID,
      correlationId: HANDOFF_ID,
      failureCode: "timeout",
      evidence: EVIDENCE
    });
    expect(fake.transition).toHaveBeenCalledWith({
      applicationId: APPLICATION_ID,
      from: "awaiting_assessment",
      to: "human_review",
      correlationId: CORRELATION_ID
    });
    expect(fake.recordAssessmentFailureHandoff.mock.invocationCallOrder[0]).toBeLessThan(
      fake.transition.mock.invocationCallOrder[0] as number
    );
  });

  it.each([
    ["timeout", providerWith(VALID_OUTPUT, "timeout")],
    ["provider_unavailable", providerWith(VALID_OUTPUT, "provider_unavailable")],
    ["invalid_output", providerWith({ ...VALID_OUTPUT, confidence: 72 })],
    [
      "unknown_evidence_reference",
      providerWith({
        ...VALID_OUTPUT,
        reasons: [{ claim: "Inventada", evidenceRefs: ["sales:2025-12"] }]
      })
    ]
  ])("routes a %s failure to manual review with the sanitized code", async (code, provider) => {
    const fake = dependencies(
      { handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } } },
      provider
    );

    const result = await routeAssessmentFailureToManualReview(fake.dependencies, input);

    expect(result).toMatchObject({ ok: true, value: { outcome: "manual_review", failureCode: code } });
    const command = fake.recordAssessmentFailureHandoff.mock.calls[0]?.[0];
    expect(command?.failureCode).toBe(code);
    expect(command?.evidence).toEqual(EVIDENCE);
  });

  it("never returns an assessment or a recommendation on the failure path", async () => {
    const fake = dependencies({
      handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } }
    });

    const result = await routeAssessmentFailureToManualReview(fake.dependencies, input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toHaveProperty("assessment");
    expect(result.value).not.toHaveProperty("recommendation");
    expect(result.value).not.toHaveProperty("approved");
  });

  it("returns an advisory assessment without transitioning when the assessment succeeds", async () => {
    const fake = dependencies(
      { handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } } },
      providerWith(VALID_OUTPUT)
    );

    const result = await routeAssessmentFailureToManualReview(fake.dependencies, input);

    expect(result).toEqual({
      ok: true,
      value: {
        outcome: "assessment_available",
        routed: false,
        assessment: expect.objectContaining({ riskBand: "medium", recommendedAction: "human_review" }),
        metadata: {
          model: "simulated-underwriter",
          promptVersion: "prompt-v1",
          generatedAt: FIXED_NOW,
          source: "simulated"
        }
      }
    });
    expect(fake.recordAssessmentFailureHandoff).not.toHaveBeenCalled();
    expect(fake.transition).not.toHaveBeenCalled();
  });

  it("reports a same-key replay as idempotent success", async () => {
    const fake = dependencies({
      handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: false } },
      transition: { ok: true, value: { applied: false, snapshot: HUMAN_REVIEW } }
    });

    const result = await routeAssessmentFailureToManualReview(fake.dependencies, input);

    expect(result).toEqual({
      ok: true,
      value: {
        outcome: "manual_review",
        manualReviewRequired: true,
        inputsPreserved: true,
        applicationState: "human_review",
        failureCode: "timeout",
        handoff: "replayed",
        correlationId: CORRELATION_ID,
        applied: false
      }
    });
  });

  it("reports a competing correlation as an explicit conflict without transitioning", async () => {
    const fake = dependencies({ handoff: { ok: false, error: { code: "correlation_conflict" } } });

    const result = await routeAssessmentFailureToManualReview(fake.dependencies, input);

    expect(result).toEqual({ ok: false, error: { code: "correlation_conflict" } });
    expect(fake.transition).not.toHaveBeenCalled();
  });

  it("reports an unknown application as not_found", async () => {
    const fake = dependencies({ handoff: { ok: false, error: { code: "not_found" } } });

    await expect(routeAssessmentFailureToManualReview(fake.dependencies, input)).resolves.toEqual({
      ok: false,
      error: { code: "not_found" }
    });
  });

  it("treats an application already in human_review as idempotent success via findById", async () => {
    const fake = dependencies({
      handoff: { ok: false, error: { code: "state_conflict", actualState: "human_review" } },
      findById: { ok: true, value: HUMAN_REVIEW }
    });

    const result = await routeAssessmentFailureToManualReview(fake.dependencies, input);

    expect(result).toEqual({
      ok: true,
      value: {
        outcome: "manual_review",
        manualReviewRequired: true,
        // No handoff row exists for this attempt (state_conflict proves it), so
        // nothing was preserved by it; the seed inserts the application directly
        // in human_review without a handoff.
        inputsPreserved: false,
        applicationState: "human_review",
        failureCode: "timeout",
        handoff: "absent",
        correlationId: CORRELATION_ID,
        applied: false
      }
    });
    expect(fake.findById).toHaveBeenCalledWith(APPLICATION_ID);
    expect(fake.transition).not.toHaveBeenCalled();
  });

  it("reports any other incompatible state as a conflict with the actual state", async () => {
    const fake = dependencies({
      handoff: { ok: false, error: { code: "state_conflict", actualState: "approved" } },
      findById: { ok: true, value: { applicationId: APPLICATION_ID, state: "approved" } }
    });

    await expect(routeAssessmentFailureToManualReview(fake.dependencies, input)).resolves.toEqual({
      ok: false,
      error: { code: "state_conflict", actualState: "approved" }
    });
    expect(fake.transition).not.toHaveBeenCalled();
  });

  it("maps an unavailable handoff to unavailable", async () => {
    const fake = dependencies({ handoff: { ok: false, error: { code: "unavailable" } } });

    await expect(routeAssessmentFailureToManualReview(fake.dependencies, input)).resolves.toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });

  it("reports a transition conflict after a durable handoff", async () => {
    const fake = dependencies({
      handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } },
      transition: { ok: false, error: { code: "state_conflict", actualState: "approved" } }
    });

    await expect(routeAssessmentFailureToManualReview(fake.dependencies, input)).resolves.toEqual({
      ok: false,
      error: { code: "state_conflict", actualState: "approved" }
    });
    expect(fake.recordAssessmentFailureHandoff).toHaveBeenCalledOnce();
  });

  it("bounds the provider call with the timeout the API owns", async () => {
    const fake = dependencies(
      { handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } } },
      providerWith(VALID_OUTPUT, undefined, 50),
      1
    );

    const result = await routeAssessmentFailureToManualReview(fake.dependencies, input);

    expect(result).toMatchObject({ ok: true, value: { outcome: "manual_review", failureCode: "timeout" } });
    expect(fake.recordAssessmentFailureHandoff.mock.calls[0]?.[0].failureCode).toBe("timeout");
  });

  it("writes the caller's handoff id as the durable handoff correlation, keeping request.id for trace", async () => {
    const fake = dependencies({
      handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } }
    });

    await routeAssessmentFailureToManualReview(fake.dependencies, input);

    expect(fake.recordAssessmentFailureHandoff.mock.calls[0]?.[0].correlationId).toBe(HANDOFF_ID);
    expect(fake.transition.mock.calls[0]?.[0].correlationId).toBe(CORRELATION_ID);
  });

  it("reports the stored canonical failure code on a replay, not the live one", async () => {
    const fake = dependencies(
      {
        handoff: {
          ok: true,
          value: { record: { ...HANDOFF_RECORD, failureCode: "invalid_output" }, applied: false }
        },
        transition: { ok: true, value: { applied: false, snapshot: HUMAN_REVIEW } }
      },
      providerWith(VALID_OUTPUT, "provider_unavailable")
    );

    const result = await routeAssessmentFailureToManualReview(fake.dependencies, input);

    expect(result).toMatchObject({
      ok: true,
      value: { failureCode: "invalid_output", handoff: "replayed" }
    });
    expect(fake.recordAssessmentFailureHandoff.mock.calls[0]?.[0].failureCode).toBe(
      "provider_unavailable"
    );
  });

  it("fails closed to not_found when the state_conflict disambiguation cannot find the application", async () => {
    const fake = dependencies({
      handoff: { ok: false, error: { code: "state_conflict", actualState: "human_review" } },
      findById: { ok: false, error: { code: "not_found" } }
    });

    await expect(routeAssessmentFailureToManualReview(fake.dependencies, input)).resolves.toEqual({
      ok: false,
      error: { code: "not_found" }
    });
  });

  it("fails closed to unavailable when the state_conflict disambiguation errors for any other reason", async () => {
    const fake = dependencies({
      handoff: { ok: false, error: { code: "state_conflict", actualState: "human_review" } },
      findById: { ok: false, error: { code: "unavailable" } }
    });

    await expect(routeAssessmentFailureToManualReview(fake.dependencies, input)).resolves.toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });

  it.each(["already_exists", "idempotency_conflict", "invalid_state"] as const)(
    "fails closed to unavailable for an unresolvable handoff error (%s)",
    async (code) => {
      const fake = dependencies({ handoff: { ok: false, error: { code } } });

      await expect(routeAssessmentFailureToManualReview(fake.dependencies, input)).resolves.toEqual({
        ok: false,
        error: { code: "unavailable" }
      });
      expect(fake.findById).not.toHaveBeenCalled();
    }
  );

  it("reports a transition that cannot find the application as not_found", async () => {
    const fake = dependencies({
      handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } },
      transition: { ok: false, error: { code: "not_found" } }
    });

    await expect(routeAssessmentFailureToManualReview(fake.dependencies, input)).resolves.toEqual({
      ok: false,
      error: { code: "not_found" }
    });
  });

  it("fails closed to unavailable for a transition state_conflict without an actual state", async () => {
    const fake = dependencies({
      handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } },
      transition: { ok: false, error: { code: "state_conflict" } }
    });

    await expect(routeAssessmentFailureToManualReview(fake.dependencies, input)).resolves.toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });

  it("fails closed to unavailable when the sanitized handoff command cannot be built", async () => {
    const fake = dependencies({
      handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } }
    });

    const result = await routeAssessmentFailureToManualReview(fake.dependencies, {
      ...input,
      evidence: { periods: [], findings: [] }
    });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(fake.recordAssessmentFailureHandoff).not.toHaveBeenCalled();
  });
});
