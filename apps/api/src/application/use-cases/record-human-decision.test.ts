import { parseCorrelationId, parseHumanDecisionCommand, parseHumanDecisionRecord } from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import type {
  ApplicationReviewRepositoryErrorCode,
  ApplicationReviewRepositoryPort,
  ApplicationReviewRepositoryResult,
  HumanDecisionRepositoryOutcome
} from "../ports/application-review-repository-port.js";
import { recordHumanDecision } from "./record-human-decision.js";

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
    recordHumanDecision: vi.fn().mockResolvedValue(result)
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
