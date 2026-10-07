import { parseCorrelationId, parseHumanDecisionCommand, parseHumanDecisionRecord } from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import type { NotificationPublisherPort } from "../ports/notification-publisher-port.js";
import type { SmeRequestRecord, SmeRequestRepositoryPort } from "../ports/sme-request-repository-port.js";
import type {
  ApplicationReviewRepositoryErrorCode,
  ApplicationReviewRepositoryPort,
  ApplicationReviewRepositoryResult,
  HumanDecisionRepositoryOutcome
} from "../ports/application-review-repository-port.js";
import { recordHumanDecision } from "./record-human-decision.js";
import type { DecisionDeploymentDependencies } from "./record-human-decision.js";

const command = parseHumanDecisionCommand({
  decisionId: "11111111-1111-4111-8111-111111111111",
  applicationId: "22222222-2222-4222-8222-222222222222",
  outcome: "approved",
  actor: "reviewer@example.test",
  reason: "Verified synthetic evidence",
  approvedLimitArs: 1_000_000
});
const correlationId = parseCorrelationId("33333333-3333-4333-8333-333333333333");
const record = parseHumanDecisionRecord({
  ...command,
  decidedAt: "2026-09-19T12:00:00.000Z",
  correlationId
});

function repositoryReturning(
  result: ApplicationReviewRepositoryResult<HumanDecisionRepositoryOutcome>
): ApplicationReviewRepositoryPort {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    transition: vi.fn(),
    recordHumanDecision: vi.fn().mockResolvedValue(result),
    recordAssessmentFailureHandoff: vi.fn(),
    readManualReviewContext: vi.fn(),
    readLatestHumanDecision: vi.fn()
  };
}

describe("recordHumanDecision", () => {
  it.each([true, false])("forwards input exactly and returns applied=%s", async (applied) => {
    const repository = repositoryReturning({ ok: true, value: { record, applied } });

    const result = await recordHumanDecision(repository, { command, correlationId });

    expect(repository.recordHumanDecision).toHaveBeenCalledWith({ command, correlationId });
    expect(result).toEqual({ ok: true, value: { decision: record, applied } });
  });

  it.each([
    ["not_found", { code: "not_found" }],
    ["idempotency_conflict", { code: "idempotency_conflict" }],
    ["unavailable", { code: "unavailable" }],
    ["already_exists", { code: "unavailable" }],
    ["invalid_state", { code: "unavailable" }]
  ] satisfies readonly [ApplicationReviewRepositoryErrorCode, { code: string }][]) (
    "maps repository error %s",
    async (code, expected) => {
      const repository = repositoryReturning({ ok: false, error: { code } });

      await expect(recordHumanDecision(repository, { command, correlationId })).resolves.toEqual({
        ok: false,
        error: expected
      });
    }
  );

  it("preserves the actual state for a state conflict", async () => {
    const repository = repositoryReturning({
      ok: false,
      error: { code: "state_conflict", actualState: "approved" }
    });

    await expect(recordHumanDecision(repository, { command, correlationId })).resolves.toEqual({
      ok: false,
      error: { code: "state_conflict", actualState: "approved" }
    });
  });

  it("maps a malformed state conflict without actual state to unavailable", async () => {
    const repository = repositoryReturning({ ok: false, error: { code: "state_conflict" } });

    await expect(recordHumanDecision(repository, { command, correlationId })).resolves.toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });
});

const OWNER = "00000000-0000-4000-8000-0000000000a1";
const DECISION_APPLICATION_ID = "22222222-2222-4222-8222-222222222222";
const SME_REQUEST: SmeRequestRecord = {
  applicationId: DECISION_APPLICATION_ID as SmeRequestRecord["applicationId"],
  request: {
    smeReference: "sme:SYN-PH-0001",
    declaredTotalArs: 15_000_000,
    periodStart: "2026-01",
    periodEnd: "2026-08",
    simuladoLabel: "SIMULADO"
  },
  ownerUserId: OWNER
};

function outcomeCommand(outcome: "approved" | "changes_requested" | "rejected") {
  return parseHumanDecisionCommand({
    decisionId: "11111111-1111-4111-8111-111111111111",
    applicationId: DECISION_APPLICATION_ID,
    outcome,
    actor: "reviewer@example.test",
    reason: "Verified synthetic evidence",
    approvedLimitArs: outcome === "approved" ? 1_000_000 : null
  });
}

function outcomeRecord(outcome: "approved" | "changes_requested" | "rejected") {
  const outcomeCommandValue = outcomeCommand(outcome);
  return parseHumanDecisionRecord({
    ...outcomeCommandValue,
    decidedAt: "2026-09-19T12:00:00.000Z",
    correlationId
  });
}

function smeRequestsReturning(
  result: { readonly ok: true; readonly value: SmeRequestRecord } | { readonly ok: false; readonly error: { readonly code: "not_found" | "unavailable" } }
): Pick<SmeRequestRepositoryPort, "findByApplicationId"> {
  return { findByApplicationId: vi.fn().mockResolvedValue(result) };
}

function notificationsSpy(): {
  notifications: Pick<NotificationPublisherPort, "publish">;
  publish: ReturnType<typeof vi.fn<NotificationPublisherPort["publish"]>>;
} {
  const publish = vi
    .fn<NotificationPublisherPort["publish"]>()
    .mockResolvedValue({ recipients: 1, inserted: 1, skipped: 0, emailsSent: 1, emailsFailed: 0, failed: false });
  return { notifications: { publish }, publish };
}

describe("recordHumanDecision decision notifications", () => {
  it.each(["changes_requested", "rejected"] as const)(
    "publishes the addressed %s event to the application owner on a real apply",
    async (outcome) => {
      const record = outcomeRecord(outcome);
      const repository = repositoryReturning({ ok: true, value: { record, applied: true } });
      const smeRequests = smeRequestsReturning({ ok: true, value: SME_REQUEST });
      const { notifications, publish } = notificationsSpy();

      const result = await recordHumanDecision(
        repository,
        { command: outcomeCommand(outcome), correlationId },
        { smeRequests, notifications }
      );

      expect(result).toEqual({ ok: true, value: { decision: record, applied: true } });
      expect(smeRequests.findByApplicationId).toHaveBeenCalledWith(DECISION_APPLICATION_ID);
      expect(publish).toHaveBeenCalledTimes(1);
      expect(publish.mock.calls[0]?.[0]).toEqual({
        eventKey: `application:${DECISION_APPLICATION_ID}:decision:${record.decisionId}:${outcome}`,
        type: outcome === "changes_requested" ? "pyme.changes_requested" : "pyme.rejected",
        recipientUserIds: [OWNER]
      });
    }
  );

  it("does not publish for an approved decision (its notification belongs to the deployment unit)", async () => {
    const record = outcomeRecord("approved");
    const repository = repositoryReturning({ ok: true, value: { record, applied: true } });
    const smeRequests = smeRequestsReturning({ ok: true, value: SME_REQUEST });
    const { notifications, publish } = notificationsSpy();

    await recordHumanDecision(
      repository,
      { command: outcomeCommand("approved"), correlationId },
      { smeRequests, notifications }
    );

    expect(publish).not.toHaveBeenCalled();
  });

  it("does not publish again on a replay", async () => {
    const record = outcomeRecord("rejected");
    const repository = repositoryReturning({ ok: true, value: { record, applied: false } });
    const smeRequests = smeRequestsReturning({ ok: true, value: SME_REQUEST });
    const { notifications, publish } = notificationsSpy();

    const result = await recordHumanDecision(
      repository,
      { command: outcomeCommand("rejected"), correlationId },
      { smeRequests, notifications }
    );

    expect(result).toEqual({ ok: true, value: { decision: record, applied: false } });
    expect(publish).not.toHaveBeenCalled();
  });

  it("skips the notification rather than broadcasting when the owner cannot be resolved", async () => {
    const record = outcomeRecord("changes_requested");
    const repository = repositoryReturning({ ok: true, value: { record, applied: true } });
    const smeRequests = smeRequestsReturning({
      ok: true,
      value: { applicationId: SME_REQUEST.applicationId, request: SME_REQUEST.request }
    });
    const { notifications, publish } = notificationsSpy();

    const result = await recordHumanDecision(
      repository,
      { command: outcomeCommand("changes_requested"), correlationId },
      { smeRequests, notifications }
    );

    expect(result.ok).toBe(true);
    expect(publish).not.toHaveBeenCalled();
  });

  it("never fails the decision when the owner lookup is unavailable or throws", async () => {
    const record = outcomeRecord("changes_requested");
    const repository = repositoryReturning({ ok: true, value: { record, applied: true } });
    const { notifications, publish } = notificationsSpy();

    const unavailable = await recordHumanDecision(
      repository,
      { command: outcomeCommand("changes_requested"), correlationId },
      { smeRequests: smeRequestsReturning({ ok: false, error: { code: "unavailable" } }), notifications }
    );
    expect(unavailable).toEqual({ ok: true, value: { decision: record, applied: true } });

    const throwing: Pick<SmeRequestRepositoryPort, "findByApplicationId"> = {
      findByApplicationId: vi.fn().mockRejectedValue(new Error("lookup unavailable"))
    };
    const thrown = await recordHumanDecision(
      repository,
      { command: outcomeCommand("changes_requested"), correlationId },
      { smeRequests: throwing, notifications }
    );
    expect(thrown).toEqual({ ok: true, value: { decision: record, applied: true } });
    expect(publish).not.toHaveBeenCalled();
  });

  it("never fails the decision when the publisher throws", async () => {
    const record = outcomeRecord("rejected");
    const repository = repositoryReturning({ ok: true, value: { record, applied: true } });
    const smeRequests = smeRequestsReturning({ ok: true, value: SME_REQUEST });
    const publish = vi.fn<NotificationPublisherPort["publish"]>().mockRejectedValue(new Error("delivery unavailable"));

    const result = await recordHumanDecision(
      repository,
      { command: outcomeCommand("rejected"), correlationId },
      { smeRequests, notifications: { publish } }
    );

    expect(result).toEqual({ ok: true, value: { decision: record, applied: true } });
  });

  it("keeps the existing no-dependency call working", async () => {
    const repository = repositoryReturning({ ok: true, value: { record, applied: true } });

    await expect(recordHumanDecision(repository, { command, correlationId })).resolves.toEqual({
      ok: true,
      value: { decision: record, applied: true }
    });
  });
});

describe("recordHumanDecision deployment trigger", () => {
  it("advances the deploy for an applied approved decision", async () => {
    const approved = outcomeRecord("approved");
    const repository = repositoryReturning({ ok: true, value: { record: approved, applied: true } });
    const onApproved = vi.fn().mockResolvedValue(undefined);

    const result = await recordHumanDecision(
      repository,
      { command: outcomeCommand("approved"), correlationId },
      undefined,
      { onApproved }
    );

    expect(result).toEqual({ ok: true, value: { decision: approved, applied: true } });
    expect(onApproved).toHaveBeenCalledWith({
      applicationId: approved.applicationId,
      correlationId: approved.correlationId
    });
  });

  it.each(["changes_requested", "rejected"] as const)(
    "does not advance the deploy for an applied %s decision",
    async (outcome) => {
      const decided = outcomeRecord(outcome);
      const repository = repositoryReturning({ ok: true, value: { record: decided, applied: true } });
      const onApproved = vi.fn().mockResolvedValue(undefined);

      await recordHumanDecision(
        repository,
        { command: outcomeCommand(outcome), correlationId },
        undefined,
        { onApproved }
      );

      expect(onApproved).not.toHaveBeenCalled();
    }
  );

  it("does not advance the deploy on a replay", async () => {
    const approved = outcomeRecord("approved");
    const repository = repositoryReturning({ ok: true, value: { record: approved, applied: false } });
    const onApproved = vi.fn().mockResolvedValue(undefined);

    await recordHumanDecision(
      repository,
      { command: outcomeCommand("approved"), correlationId },
      undefined,
      { onApproved }
    );

    expect(onApproved).not.toHaveBeenCalled();
  });

  it("never fails the decision when the deployment trigger rejects or throws", async () => {
    const approved = outcomeRecord("approved");
    const repository = repositoryReturning({ ok: true, value: { record: approved, applied: true } });

    const rejecting: DecisionDeploymentDependencies = {
      onApproved: vi.fn().mockRejectedValue(new Error("deploy unavailable"))
    };
    const throwing: DecisionDeploymentDependencies = {
      onApproved: vi.fn().mockImplementation(() => {
        throw new Error("deploy unavailable");
      })
    };

    for (const deployment of [rejecting, throwing]) {
      await expect(
        recordHumanDecision(
          repository,
          { command: outcomeCommand("approved"), correlationId },
          undefined,
          deployment
        )
      ).resolves.toEqual({ ok: true, value: { decision: approved, applied: true } });
    }
  });

  it("keeps the decision response independent of a slow trigger", async () => {
    const approved = outcomeRecord("approved");
    const repository = repositoryReturning({ ok: true, value: { record: approved, applied: true } });
    // A trigger that never settles would block the response if it were awaited.
    const onApproved = vi.fn().mockImplementation(() => new Promise<void>(() => undefined));

    const result = await recordHumanDecision(
      repository,
      { command: outcomeCommand("approved"), correlationId },
      undefined,
      { onApproved }
    );

    expect(result).toEqual({ ok: true, value: { decision: approved, applied: true } });
  });
});
