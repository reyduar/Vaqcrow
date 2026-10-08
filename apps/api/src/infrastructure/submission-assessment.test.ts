import { createSimulatedAssessmentProvider } from "@vaqcrow/ai";
import type { AssessmentProviderPort } from "@vaqcrow/ai";
import { parseApplicationId, parseAssessmentHandoffId, parseCorrelationId } from "@vaqcrow/contracts";
import type { AssessmentHandoffId, SmeRequest } from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import type {
  ApplicationAssessmentRepositoryPort,
  StoredApplicationAssessment
} from "../application/ports/application-assessment-repository-port.js";
import type { ApplicationReviewRepositoryPort } from "../application/ports/application-review-repository-port.js";
import { routeApplicationAssessment } from "../application/use-cases/route-application-assessment.js";
import type { RouteApplicationAssessmentDependencies } from "../application/use-cases/route-application-assessment.js";
import { createSubmissionAssessment } from "./submission-assessment.js";

/**
 * The background assessment a real submission starts (U12). It reuses the
 * application-scoped assessment use case unchanged; the provider is the AI
 * package's deterministic simulated implementation, so no case calls a model.
 */

const APPLICATION_ID = parseApplicationId("55555555-5555-4555-8555-555555555555");
const CORRELATION_ID = parseCorrelationId("66666666-6666-4666-8666-666666666666");
const OTHER_HANDOFF = parseAssessmentHandoffId("77777777-7777-4777-8777-777777777777");
const FIXED_NOW = "2026-10-08T12:00:00.000Z";
const RECORDED_AT = "2026-10-08T12:00:01.000Z";

const PERIOD = {
  period: "2026-01",
  amountArs: 3_000_000,
  status: "reported",
  evidenceRef: "sales:2026-01",
  simuladoLabel: "SIMULADO"
} as const;

const VALID_OUTPUT = {
  assessmentId: "asm_auto_001",
  riskBand: "medium",
  confidence: 0.6,
  reasons: [{ claim: "Ventas estables", evidenceRefs: ["sales:2026-01"] }],
  anomalies: [],
  missingData: [],
  recommendedAction: "human_review",
  questions: []
} as const;

const SME_REQUEST: SmeRequest = {
  smeReference: "30712345678",
  declaredTotalArs: 15_000_000,
  periodStart: "2026-01",
  periodEnd: "2026-08",
  simuladoLabel: "SIMULADO"
};

function countingProvider(failWith?: "timeout"): {
  provider: AssessmentProviderPort;
  assess: ReturnType<typeof vi.fn>;
} {
  const inner = createSimulatedAssessmentProvider({
    output: VALID_OUTPUT,
    ...(failWith === undefined ? {} : { failWith }),
    now: () => FIXED_NOW
  });
  const assess = vi.fn((input: Parameters<AssessmentProviderPort["assess"]>[0]) => inner.assess(input));
  return { provider: { assess }, assess };
}

/** An in-memory assessment store with the repository's attempt-keyed replay semantics. */
function inMemoryAssessments() {
  let stored: StoredApplicationAssessment | undefined;
  const record = vi.fn<ApplicationAssessmentRepositoryPort["record"]>(async (command) => {
    if (stored !== undefined) {
      return stored.attemptId === command.attemptId
        ? { ok: true, value: { record: stored.record, applied: false } }
        : { ok: false, error: { code: "attempt_conflict" } };
    }
    stored = {
      attemptId: command.attemptId,
      record: { assessment: command.assessment, metadata: command.metadata, recordedAt: RECORDED_AT }
    };
    return { ok: true, value: { record: stored.record, applied: true } };
  });
  const findStoredByApplicationId = vi.fn<ApplicationAssessmentRepositoryPort["findStoredByApplicationId"]>(
    async () => (stored === undefined ? { ok: false, error: { code: "not_found" } } : { ok: true, value: stored })
  );
  return { record, findStoredByApplicationId };
}

function dependencies(
  overrides: {
    readonly provider?: AssessmentProviderPort;
    readonly periods?: readonly (typeof PERIOD)[];
    readonly findStored?: ApplicationAssessmentRepositoryPort["findStoredByApplicationId"];
  } = {}
) {
  const assessments = inMemoryAssessments();
  const recordAssessmentFailureHandoff = vi
    .fn<ApplicationReviewRepositoryPort["recordAssessmentFailureHandoff"]>()
    .mockImplementation(async (command) => ({
      ok: true,
      value: {
        record: {
          applicationId: command.applicationId,
          correlationId: command.correlationId,
          failureCode: command.failureCode,
          evidence: command.evidence
        },
        applied: true
      }
    }));
  const transition = vi.fn<ApplicationReviewRepositoryPort["transition"]>().mockResolvedValue({
    ok: true,
    value: { applied: true, snapshot: { applicationId: APPLICATION_ID, state: "human_review" } }
  });
  const deps: RouteApplicationAssessmentDependencies = {
    repository: {
      findById: vi.fn().mockResolvedValue({ ok: true, value: { applicationId: APPLICATION_ID, state: "human_review" } }),
      recordAssessmentFailureHandoff,
      transition
    },
    assessments: {
      record: assessments.record,
      findStoredByApplicationId: overrides.findStored ?? assessments.findStoredByApplicationId
    },
    smeRequests: {
      findByApplicationId: vi
        .fn()
        .mockResolvedValue({ ok: true, value: { applicationId: APPLICATION_ID, request: SME_REQUEST } })
    },
    salesData: { getPeriods: vi.fn().mockResolvedValue({ ok: true, value: overrides.periods ?? [PERIOD] }) },
    provider: overrides.provider ?? countingProvider().provider,
    timeoutMs: 5_000
  };
  return { deps, assessments, recordAssessmentFailureHandoff, transition };
}

describe("createSubmissionAssessment", () => {
  it("records the assessment under the application id as its attempt key, with the submission correlation", async () => {
    const counting = countingProvider();
    const fake = dependencies({ provider: counting.provider });
    const log = vi.fn();

    await createSubmissionAssessment(fake.deps, log).onSubmitted({
      applicationId: APPLICATION_ID,
      correlationId: CORRELATION_ID
    });

    expect(counting.assess).toHaveBeenCalledTimes(1);
    expect(fake.assessments.record).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: APPLICATION_ID,
        attemptId: APPLICATION_ID as unknown as AssessmentHandoffId,
        correlationId: CORRELATION_ID
      })
    );
    expect(log).not.toHaveBeenCalled();
  });

  it("routes a provider failure to manual review through the existing handoff path", async () => {
    const fake = dependencies({ provider: countingProvider("timeout").provider });
    const log = vi.fn();

    await createSubmissionAssessment(fake.deps, log).onSubmitted({
      applicationId: APPLICATION_ID,
      correlationId: CORRELATION_ID
    });

    expect(fake.recordAssessmentFailureHandoff).toHaveBeenCalledWith(
      expect.objectContaining({ applicationId: APPLICATION_ID, correlationId: APPLICATION_ID, failureCode: "timeout" })
    );
    expect(fake.transition).toHaveBeenCalledWith(
      expect.objectContaining({ from: "awaiting_assessment", to: "human_review", correlationId: CORRELATION_ID })
    );
    expect(fake.assessments.record).not.toHaveBeenCalled();
    // Manual review is a routed outcome, not a failure of the trigger.
    expect(log).not.toHaveBeenCalled();
  });

  it("logs only the sanitized code when the assessment cannot run, and resolves", async () => {
    const fake = dependencies({ periods: [] });
    const log = vi.fn();

    await expect(
      createSubmissionAssessment(fake.deps, log).onSubmitted({
        applicationId: APPLICATION_ID,
        correlationId: CORRELATION_ID
      })
    ).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({
      event: "submission_assessment_failed",
      applicationId: APPLICATION_ID,
      correlationId: CORRELATION_ID,
      code: "sales_evidence_missing"
    });
  });

  it("swallows an unexpected throw, logging a closed code and never the message", async () => {
    const fake = dependencies({
      findStored: vi.fn().mockRejectedValue(new Error("SECRET connection string"))
    });
    const log = vi.fn();

    await expect(
      createSubmissionAssessment(fake.deps, log).onSubmitted({
        applicationId: APPLICATION_ID,
        correlationId: CORRELATION_ID
      })
    ).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledWith({
      event: "submission_assessment_failed",
      applicationId: APPLICATION_ID,
      correlationId: CORRELATION_ID,
      code: "unexpected"
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("SECRET");
  });

  it("leaves the manual assessment route idempotent after the automatic run", async () => {
    const counting = countingProvider();
    const fake = dependencies({ provider: counting.provider });

    await createSubmissionAssessment(fake.deps, vi.fn()).onSubmitted({
      applicationId: APPLICATION_ID,
      correlationId: CORRELATION_ID
    });

    // Same attempt key (the application id): a replay of the stored record.
    const replay = await routeApplicationAssessment(fake.deps, {
      applicationId: APPLICATION_ID,
      handoffId: APPLICATION_ID as unknown as AssessmentHandoffId,
      correlationId: CORRELATION_ID
    });
    expect(replay).toMatchObject({ ok: true, value: { outcome: "assessment_recorded", applied: false } });

    // Any other key: the explicit correlation conflict the route already maps to 409.
    const conflict = await routeApplicationAssessment(fake.deps, {
      applicationId: APPLICATION_ID,
      handoffId: OTHER_HANDOFF,
      correlationId: CORRELATION_ID
    });
    expect(conflict).toEqual({ ok: false, error: { code: "correlation_conflict" } });

    // Neither call spent a second provider run.
    expect(counting.assess).toHaveBeenCalledTimes(1);
  });
});
