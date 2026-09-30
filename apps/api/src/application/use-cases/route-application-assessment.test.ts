import { createSimulatedAssessmentProvider } from "@vaqcrow/ai";
import type { AssessmentEvidenceBundle, AssessmentProviderPort } from "@vaqcrow/ai";
import { parseApplicationId, parseAssessmentHandoffId, parseCorrelationId } from "@vaqcrow/contracts";
import type {
  ApplicationAssessment,
  ApplicationReviewSnapshot,
  AssessmentFailureHandoffRecord,
  SmeRequest
} from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import type {
  ApplicationReviewRepositoryPort,
  ApplicationReviewRepositoryResult,
  ApplicationReviewTransitionOutcome,
  AssessmentFailureHandoffRepositoryOutcome
} from "../ports/application-review-repository-port.js";
import type {
  ApplicationAssessmentRecordOutcome,
  ApplicationAssessmentRepositoryPort,
  ApplicationAssessmentRepositoryResult,
  StoredApplicationAssessment
} from "../ports/application-assessment-repository-port.js";
import type { SalesDataProviderPort, SalesDataProviderResult } from "../ports/sales-data-provider-port.js";
import type { SmeRequestRepositoryPort, SmeRequestRepositoryResult, SmeRequestRecord } from "../ports/sme-request-repository-port.js";
import { routeApplicationAssessment } from "./route-application-assessment.js";

/**
 * Focused behaviour for the application-scoped assessment (Feature #22 Task #71,
 * Feature #30 Task #95 / T3a). The evidence is derived server-side from the
 * persisted SME request and its sales periods. A failure persists the sanitized
 * handoff before it transitions `awaiting_assessment -> human_review`, and never
 * becomes an assessment or an approval; a success is persisted (and the
 * transition made) atomically by the assessment repository. Replay, competing
 * attempts, unknown application and incompatible state resolve explicitly.
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

const SME_REQUEST: SmeRequest = {
  smeReference: "sme:SYN-PH-0001",
  declaredTotalArs: 15_000_000,
  periodStart: "2026-01",
  periodEnd: "2026-08",
  simuladoLabel: "SIMULADO"
};

const RECORDED_AT = "2026-09-30T12:00:01.000Z";

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

interface CollaboratorOverrides {
  readonly smeRequest?: SmeRequestRepositoryResult<SmeRequestRecord>;
  readonly sales?: SalesDataProviderResult<readonly (typeof JANUARY | typeof JUNE)[]>;
  readonly record?: ApplicationAssessmentRepositoryResult<ApplicationAssessmentRecordOutcome>;
  readonly stored?: ApplicationAssessmentRepositoryResult<StoredApplicationAssessment>;
}

function dependencies(
  overrides: Parameters<typeof routingRepository>[0],
  provider: AssessmentProviderPort = providerWith(VALID_OUTPUT, "timeout"),
  timeoutMs = 5_000,
  collaborators: CollaboratorOverrides = {}
) {
  const fake = routingRepository(overrides);
  const findByApplicationId = vi
    .fn<SmeRequestRepositoryPort["findByApplicationId"]>()
    .mockResolvedValue(
      collaborators.smeRequest ?? { ok: true, value: { applicationId: APPLICATION_ID, request: SME_REQUEST } }
    );
  const getPeriods = vi
    .fn<SalesDataProviderPort["getPeriods"]>()
    .mockResolvedValue(collaborators.sales ?? { ok: true, value: EVIDENCE.periods });
  const record = vi.fn<ApplicationAssessmentRepositoryPort["record"]>().mockImplementation(async (command) =>
    collaborators.record ?? {
      ok: true,
      value: {
        record: { assessment: command.assessment, metadata: command.metadata, recordedAt: RECORDED_AT },
        applied: true
      }
    }
  );

  const findStored = vi
    .fn<ApplicationAssessmentRepositoryPort["findStoredByApplicationId"]>()
    .mockResolvedValue(collaborators.stored ?? { ok: false, error: { code: "not_found" } });

  return {
    ...fake,
    findByApplicationId,
    getPeriods,
    record,
    findStored,
    dependencies: {
      repository: fake.repository,
      assessments: { record, findStoredByApplicationId: findStored },
      smeRequests: { findByApplicationId },
      salesData: { getPeriods },
      provider,
      timeoutMs
    }
  };
}

const input = {
  applicationId: APPLICATION_ID,
  handoffId: HANDOFF_ID,
  correlationId: CORRELATION_ID
};

describe("routeApplicationAssessment", () => {
  it("persists the sanitized handoff first, then transitions, and labels manual review", async () => {
    const fake = dependencies({
      handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } }
    });

    const result = await routeApplicationAssessment(fake.dependencies, input);

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

    const result = await routeApplicationAssessment(fake.dependencies, input);

    expect(result).toMatchObject({ ok: true, value: { outcome: "manual_review", failureCode: code } });
    const command = fake.recordAssessmentFailureHandoff.mock.calls[0]?.[0];
    expect(command?.failureCode).toBe(code);
    expect(command?.evidence).toEqual(EVIDENCE);
  });

  it("never returns an assessment or a recommendation on the failure path", async () => {
    const fake = dependencies({
      handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } }
    });

    const result = await routeApplicationAssessment(fake.dependencies, input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toHaveProperty("assessment");
    expect(result.value).not.toHaveProperty("recommendation");
    expect(result.value).not.toHaveProperty("approved");
  });

  it("derives the evidence server-side from the persisted request and its sales periods", async () => {
    const fake = dependencies({
      handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } }
    });

    await routeApplicationAssessment(fake.dependencies, input);

    expect(fake.findByApplicationId).toHaveBeenCalledWith(APPLICATION_ID);
    expect(fake.getPeriods).toHaveBeenCalledWith(SME_REQUEST.smeReference);
    // The failure handoff preserves exactly the derived bundle.
    expect(fake.recordAssessmentFailureHandoff.mock.calls[0]?.[0].evidence).toEqual({
      periods: EVIDENCE.periods,
      findings: []
    });
  });

  it("persists a successful assessment through the atomic repository and reports human_review", async () => {
    const fake = dependencies(
      { handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } } },
      providerWith(VALID_OUTPUT)
    );

    const result = await routeApplicationAssessment(fake.dependencies, input);

    expect(result).toEqual({
      ok: true,
      value: {
        outcome: "assessment_recorded",
        applicationState: "human_review",
        applied: true,
        correlationId: CORRELATION_ID,
        assessment: expect.objectContaining({ riskBand: "medium", recommendedAction: "human_review" }),
        metadata: {
          model: "simulated-underwriter",
          promptVersion: "prompt-v1",
          generatedAt: FIXED_NOW,
          source: "simulated"
        },
        recordedAt: RECORDED_AT
      }
    });
    expect(fake.record).toHaveBeenCalledWith({
      applicationId: APPLICATION_ID,
      // The caller's handoff id is the attempt key; request.id stays the trace.
      attemptId: HANDOFF_ID,
      correlationId: CORRELATION_ID,
      assessment: expect.objectContaining({ assessmentId: "asm_demo_001" }),
      metadata: expect.objectContaining({ source: "simulated" })
    });
    // The success path never touches the failure handoff nor transitions separately.
    expect(fake.recordAssessmentFailureHandoff).not.toHaveBeenCalled();
    expect(fake.transition).not.toHaveBeenCalled();
  });

  it("reports a same-attempt success replay with the stored record and applied: false", async () => {
    const stored = { ...VALID_OUTPUT, assessmentId: "asm_stored" } as unknown as ApplicationAssessment;
    const fake = dependencies(
      { handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } } },
      providerWith(VALID_OUTPUT),
      5_000,
      {
        record: {
          ok: true,
          value: {
            record: {
              assessment: stored,
              metadata: { model: "stored", promptVersion: "v0", generatedAt: FIXED_NOW, source: "simulated" },
              recordedAt: RECORDED_AT
            },
            applied: false
          }
        }
      }
    );

    const result = await routeApplicationAssessment(fake.dependencies, input);

    expect(result).toMatchObject({
      ok: true,
      value: {
        outcome: "assessment_recorded",
        applied: false,
        assessment: { assessmentId: "asm_stored" },
        metadata: { model: "stored" }
      }
    });
  });

  describe("a retry after a recorded success", () => {
    const STORED_RECORD = {
      assessment: { ...VALID_OUTPUT, assessmentId: "asm_stored" } as unknown as ApplicationAssessment,
      metadata: { model: "stored", promptVersion: "v0", generatedAt: FIXED_NOW, source: "simulated" as const },
      recordedAt: RECORDED_AT
    };

    it("replays the stored record for the same attempt without evidence, provider or feed", async () => {
      const provider = providerWith(VALID_OUTPUT);
      const run = vi.spyOn(provider, "assess");
      const fake = dependencies(
        { handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } } },
        provider,
        5_000,
        {
          stored: { ok: true, value: { attemptId: HANDOFF_ID, record: STORED_RECORD } },
          // Everything downstream would fail: the replay must not depend on any of it.
          smeRequest: { ok: false, error: { code: "unavailable" } },
          sales: { ok: false, error: { code: "unavailable" } }
        }
      );

      const result = await routeApplicationAssessment(fake.dependencies, input);

      expect(result).toEqual({
        ok: true,
        value: {
          outcome: "assessment_recorded",
          applicationState: "human_review",
          applied: false,
          correlationId: CORRELATION_ID,
          assessment: STORED_RECORD.assessment,
          metadata: STORED_RECORD.metadata,
          recordedAt: RECORDED_AT
        }
      });
      expect(run).not.toHaveBeenCalled();
      expect(fake.findByApplicationId).not.toHaveBeenCalled();
      expect(fake.getPeriods).not.toHaveBeenCalled();
      expect(fake.record).not.toHaveBeenCalled();
    });

    it("reports a correlation conflict for a different attempt without running anything", async () => {
      const provider = providerWith(VALID_OUTPUT);
      const run = vi.spyOn(provider, "assess");
      const otherAttempt = parseAssessmentHandoffId("55555555-5555-4555-8555-555555555555");
      const fake = dependencies(
        { handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } } },
        provider,
        5_000,
        { stored: { ok: true, value: { attemptId: otherAttempt, record: STORED_RECORD } } }
      );

      const result = await routeApplicationAssessment(fake.dependencies, input);

      expect(result).toEqual({ ok: false, error: { code: "correlation_conflict" } });
      expect(run).not.toHaveBeenCalled();
      expect(fake.getPeriods).not.toHaveBeenCalled();
    });

    it("fails closed as unavailable when the stored lookup itself fails", async () => {
      const fake = dependencies(
        { handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } } },
        providerWith(VALID_OUTPUT),
        5_000,
        { stored: { ok: false, error: { code: "unavailable" } } }
      );

      expect(await routeApplicationAssessment(fake.dependencies, input)).toEqual({
        ok: false,
        error: { code: "unavailable" }
      });
      expect(fake.record).not.toHaveBeenCalled();
    });
  });

  it.each([
    [
      "a different attempt against an assessed application",
      { ok: false, error: { code: "attempt_conflict" } },
      { code: "correlation_conflict" }
    ],
    [
      "an application outside awaiting_assessment",
      { ok: false, error: { code: "state_conflict", actualState: "approved" } },
      { code: "state_conflict", actualState: "approved" }
    ],
    ["an unknown application", { ok: false, error: { code: "not_found" } }, { code: "not_found" }],
    ["a persistence failure", { ok: false, error: { code: "unavailable" } }, { code: "unavailable" }]
  ] as const)("maps %s on the success path", async (_label, record, error) => {
    const fake = dependencies(
      { handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } } },
      providerWith(VALID_OUTPUT),
      5_000,
      { record }
    );

    await expect(routeApplicationAssessment(fake.dependencies, input)).resolves.toEqual({ ok: false, error });
  });

  it("is not_found when the application has no persisted request, without calling the provider or sales", async () => {
    const fake = dependencies({ handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } } }, undefined, 5_000, {
      smeRequest: { ok: false, error: { code: "not_found" } }
    });

    await expect(routeApplicationAssessment(fake.dependencies, input)).resolves.toEqual({
      ok: false,
      error: { code: "not_found" }
    });
    expect(fake.getPeriods).not.toHaveBeenCalled();
    expect(fake.record).not.toHaveBeenCalled();
    expect(fake.recordAssessmentFailureHandoff).not.toHaveBeenCalled();
  });

  it("is unavailable when the request or the sales feed cannot be read", async () => {
    const noRequest = dependencies({ handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } } }, undefined, 5_000, {
      smeRequest: { ok: false, error: { code: "unavailable" } }
    });
    const noSales = dependencies({ handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } } }, undefined, 5_000, {
      sales: { ok: false, error: { code: "unavailable" } }
    });

    await expect(routeApplicationAssessment(noRequest.dependencies, input)).resolves.toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
    await expect(routeApplicationAssessment(noSales.dependencies, input)).resolves.toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });

  it.each([
    ["an empty series", { ok: true, value: [] }],
    ["a reference the sales feed does not know", { ok: false, error: { code: "not_found" } }]
  ] as const)(
    "declares sales_evidence_missing for %s: no provider run, no handoff, no transition",
    async (_label, sales) => {
      const provider = providerWith(VALID_OUTPUT);
      const generate = vi.spyOn(provider, "assess");
      const fake = dependencies({ handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } } }, provider, 5_000, {
        sales
      });

      await expect(routeApplicationAssessment(fake.dependencies, input)).resolves.toEqual({
        ok: false,
        error: { code: "sales_evidence_missing" }
      });
      expect(generate).not.toHaveBeenCalled();
      expect(fake.record).not.toHaveBeenCalled();
      expect(fake.recordAssessmentFailureHandoff).not.toHaveBeenCalled();
      expect(fake.transition).not.toHaveBeenCalled();
    }
  );

  it("reports a same-key replay as idempotent success", async () => {
    const fake = dependencies({
      handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: false } },
      transition: { ok: true, value: { applied: false, snapshot: HUMAN_REVIEW } }
    });

    const result = await routeApplicationAssessment(fake.dependencies, input);

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

    const result = await routeApplicationAssessment(fake.dependencies, input);

    expect(result).toEqual({ ok: false, error: { code: "correlation_conflict" } });
    expect(fake.transition).not.toHaveBeenCalled();
  });

  it("reports an unknown application as not_found", async () => {
    const fake = dependencies({ handoff: { ok: false, error: { code: "not_found" } } });

    await expect(routeApplicationAssessment(fake.dependencies, input)).resolves.toEqual({
      ok: false,
      error: { code: "not_found" }
    });
  });

  it("treats an application already in human_review as idempotent success via findById", async () => {
    const fake = dependencies({
      handoff: { ok: false, error: { code: "state_conflict", actualState: "human_review" } },
      findById: { ok: true, value: HUMAN_REVIEW }
    });

    const result = await routeApplicationAssessment(fake.dependencies, input);

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

    await expect(routeApplicationAssessment(fake.dependencies, input)).resolves.toEqual({
      ok: false,
      error: { code: "state_conflict", actualState: "approved" }
    });
    expect(fake.transition).not.toHaveBeenCalled();
  });

  it("maps an unavailable handoff to unavailable", async () => {
    const fake = dependencies({ handoff: { ok: false, error: { code: "unavailable" } } });

    await expect(routeApplicationAssessment(fake.dependencies, input)).resolves.toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });

  it("reports a transition conflict after a durable handoff", async () => {
    const fake = dependencies({
      handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } },
      transition: { ok: false, error: { code: "state_conflict", actualState: "approved" } }
    });

    await expect(routeApplicationAssessment(fake.dependencies, input)).resolves.toEqual({
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

    const result = await routeApplicationAssessment(fake.dependencies, input);

    expect(result).toMatchObject({ ok: true, value: { outcome: "manual_review", failureCode: "timeout" } });
    expect(fake.recordAssessmentFailureHandoff.mock.calls[0]?.[0].failureCode).toBe("timeout");
  });

  it("writes the caller's handoff id as the durable handoff correlation, keeping request.id for trace", async () => {
    const fake = dependencies({
      handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } }
    });

    await routeApplicationAssessment(fake.dependencies, input);

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

    const result = await routeApplicationAssessment(fake.dependencies, input);

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

    await expect(routeApplicationAssessment(fake.dependencies, input)).resolves.toEqual({
      ok: false,
      error: { code: "not_found" }
    });
  });

  it("fails closed to unavailable when the state_conflict disambiguation errors for any other reason", async () => {
    const fake = dependencies({
      handoff: { ok: false, error: { code: "state_conflict", actualState: "human_review" } },
      findById: { ok: false, error: { code: "unavailable" } }
    });

    await expect(routeApplicationAssessment(fake.dependencies, input)).resolves.toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });

  it.each(["already_exists", "idempotency_conflict", "invalid_state"] as const)(
    "fails closed to unavailable for an unresolvable handoff error (%s)",
    async (code) => {
      const fake = dependencies({ handoff: { ok: false, error: { code } } });

      await expect(routeApplicationAssessment(fake.dependencies, input)).resolves.toEqual({
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

    await expect(routeApplicationAssessment(fake.dependencies, input)).resolves.toEqual({
      ok: false,
      error: { code: "not_found" }
    });
  });

  it("fails closed to unavailable for a transition state_conflict without an actual state", async () => {
    const fake = dependencies({
      handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } },
      transition: { ok: false, error: { code: "state_conflict" } }
    });

    await expect(routeApplicationAssessment(fake.dependencies, input)).resolves.toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });

  it("fails closed to unavailable when the sanitized handoff command cannot be built", async () => {
    const fake = dependencies({
      handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } }
    });

    const result = await routeApplicationAssessment(fake.dependencies, {
      ...input,
      // Not a uuid: only a boundary defect can reach the command builder like this.
      handoffId: "not-a-uuid" as never
    });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(fake.recordAssessmentFailureHandoff).not.toHaveBeenCalled();
  });

  it("completes a pending transition on a replayed handoff (crash recovery) as applied", async () => {
    // The durable handoff survived but the transition did not: a same-key retry
    // replays the handoff and finishes the transition. `applied` follows the
    // transition, so this attempt still counts as the one that routed it.
    const fake = dependencies({
      handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: false } },
      transition: { ok: true, value: { applied: true, snapshot: HUMAN_REVIEW } }
    });

    const result = await routeApplicationAssessment(fake.dependencies, input);

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
        applied: true
      }
    });
  });

  it("labels the failure with exactly the routing keys: no assessment, recommendation, decision or approval", async () => {
    const fake = dependencies({ handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } } });

    const result = await routeApplicationAssessment(fake.dependencies, input);

    if (!result.ok) throw new Error("expected a manual-review routing outcome");
    expect(Object.keys(result.value).sort()).toEqual([
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

  it("is deterministic and reaches no network: the same input yields the same result across runs", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    try {
      const runFailure = async () => {
        const fake = dependencies({ handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } } });
        const result = await routeApplicationAssessment(fake.dependencies, input);
        return { result, command: fake.recordAssessmentFailureHandoff.mock.calls[0]?.[0] };
      };
      const runSuccess = async () => {
        const fake = dependencies(
          { handoff: { ok: true, value: { record: HANDOFF_RECORD, applied: true } } },
          providerWith(VALID_OUTPUT)
        );
        return routeApplicationAssessment(fake.dependencies, input);
      };

      const [failureA, failureB] = await Promise.all([runFailure(), runFailure()]);
      const [successA, successB] = await Promise.all([runSuccess(), runSuccess()]);

      expect(failureA.result).toEqual(failureB.result);
      expect(failureA.command).toEqual(failureB.command);
      expect(successA).toEqual(successB);
      // The metadata timestamp is the injected fixed clock, never wall time, so the
      // advisory result is stable across runs.
      expect(successA).toMatchObject({
        ok: true,
        value: { metadata: { generatedAt: FIXED_NOW, source: "simulated" } }
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
