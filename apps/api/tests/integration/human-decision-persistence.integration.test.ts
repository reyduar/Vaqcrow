import { randomUUID } from "node:crypto";
import {
  generateCorrelationId,
  parseHumanDecisionCommand,
  parseHumanDecisionRecord
} from "@vaqcrow/contracts";
import type {
  ApplicationId,
  CorrelationId,
  HumanDecisionCommand
} from "@vaqcrow/contracts";
import { describe, expect, it } from "vitest";
import { SupabaseApplicationReviewRepository } from "../../src/infrastructure/adapters/supabase-application-review-repository.js";
import {
  getPublishableClient,
  getServiceRoleClient,
  hasIntegrationCredentials,
  registerSyntheticCleanupHooks
} from "./support/integration-clients.js";
import { syntheticApplicationId } from "./support/synthetic-id.js";

const AUDIT_TABLE = "human_decision";
const APPLICATION_TABLE = "application_review";

interface RawAuditRow {
  readonly decision_id: string;
  readonly application_id: string;
  readonly outcome: string;
  readonly actor: string;
  readonly reason: string;
  readonly approved_limit_ars: number;
  readonly decided_at: string;
  readonly correlation_id: string;
}

interface RawApplicationRow {
  readonly state: string;
  readonly updated_at: string;
}

function repository(): SupabaseApplicationReviewRepository {
  return new SupabaseApplicationReviewRepository(getServiceRoleClient());
}

function approvedDecision(
  applicationId: ApplicationId,
  overrides: Partial<{
    decisionId: string;
    actor: string;
    reason: string;
    approvedLimitArs: number;
  }> = {}
): HumanDecisionCommand {
  return parseHumanDecisionCommand({
    decisionId: overrides.decisionId ?? randomUUID(),
    applicationId,
    outcome: "approved",
    actor: overrides.actor ?? "credit-committee@example.test",
    reason: overrides.reason ?? "Synthetic evidence supports approval.",
    approvedLimitArs: overrides.approvedLimitArs ?? 5_000_000
  });
}

async function createHumanReviewApplication(): Promise<ApplicationId> {
  const applicationId = syntheticApplicationId();
  const reviewRepository = repository();

  const created = await reviewRepository.create({
    applicationId,
    state: "draft",
    correlationId: generateCorrelationId()
  });
  expect(created.ok).toBe(true);

  const awaitingAssessment = await reviewRepository.transition({
    applicationId,
    from: "draft",
    to: "awaiting_assessment",
    correlationId: generateCorrelationId()
  });
  expect(awaitingAssessment).toMatchObject({ ok: true, value: { applied: true } });

  const humanReview = await reviewRepository.transition({
    applicationId,
    from: "awaiting_assessment",
    to: "human_review",
    correlationId: generateCorrelationId()
  });
  expect(humanReview).toMatchObject({ ok: true, value: { applied: true } });

  return applicationId;
}

async function selectAuditRows(applicationId: ApplicationId): Promise<readonly RawAuditRow[]> {
  const { data, error } = await getServiceRoleClient()
    .from(AUDIT_TABLE)
    .select(
      "decision_id, application_id, outcome, actor, reason, approved_limit_ars, decided_at, correlation_id"
    )
    .eq("application_id", applicationId);
  if (error) throw error;
  return (data ?? []) as RawAuditRow[];
}

async function selectApplicationRow(applicationId: ApplicationId): Promise<RawApplicationRow> {
  const { data, error } = await getServiceRoleClient()
    .from(APPLICATION_TABLE)
    .select("state, updated_at")
    .eq("application_id", applicationId)
    .single();
  if (error) throw error;
  return data as RawApplicationRow;
}

async function recordApprovedDecision(
  command: HumanDecisionCommand,
  correlationId: CorrelationId = generateCorrelationId()
) {
  const result = await repository().recordHumanDecision({ command, correlationId });
  if (!result.ok) {
    throw new Error(`Expected applied decision, received ${result.error.code}`);
  }
  expect(result.value.applied).toBe(true);
  return result.value;
}

/**
 * Live coverage for the atomic human-decision RPC and immutable audit table.
 * The suite skips unless every real Supabase credential is available. Parent
 * cleanup exercises the audit FK's ON DELETE CASCADE rather than DELETE grants.
 */
describe.skipIf(!hasIntegrationCredentials())("human decisions (live integration)", () => {
  registerSyntheticCleanupHooks();

  it("applies approval and persists the exact contract-valid server-timestamped audit record", async () => {
    const applicationId = await createHumanReviewApplication();
    const command = approvedDecision(applicationId);
    const correlationId = generateCorrelationId();

    const decision = await recordApprovedDecision(command, correlationId);

    expect(parseHumanDecisionRecord(decision.record)).toEqual(decision.record);
    expect(decision.record).toMatchObject({ ...command, correlationId });
    expect(Number.isNaN(Date.parse(decision.record.decidedAt))).toBe(false);
    expect(await repository().findById(applicationId)).toEqual({
      ok: true,
      value: { applicationId, state: "approved" }
    });

    const rows = await selectAuditRows(applicationId);
    expect(rows).toEqual([
      {
        decision_id: command.decisionId,
        application_id: applicationId,
        outcome: "approved",
        actor: command.actor,
        reason: command.reason,
        approved_limit_ars: command.approvedLimitArs,
        decided_at: decision.record.decidedAt,
        correlation_id: correlationId
      }
    ]);
  });

  it("replays the original immutable record without a second row or updated_at mutation", async () => {
    const applicationId = await createHumanReviewApplication();
    const command = approvedDecision(applicationId);
    const originalCorrelationId = generateCorrelationId();
    const original = await recordApprovedDecision(command, originalCorrelationId);
    const applicationAfterFirst = await selectApplicationRow(applicationId);

    const replay = await repository().recordHumanDecision({
      command,
      correlationId: generateCorrelationId()
    });

    expect(replay).toEqual({
      ok: true,
      value: {
        applied: false,
        record: {
          ...command,
          decidedAt: original.record.decidedAt,
          correlationId: originalCorrelationId
        }
      }
    });
    expect(await selectAuditRows(applicationId)).toHaveLength(1);
    expect(await selectApplicationRow(applicationId)).toEqual(applicationAfterFirst);
  });

  it("rejects changed business payload for the same decision id without mutation", async () => {
    const applicationId = await createHumanReviewApplication();
    const command = approvedDecision(applicationId);
    await recordApprovedDecision(command);
    const auditBefore = await selectAuditRows(applicationId);
    const applicationBefore = await selectApplicationRow(applicationId);
    const changed = approvedDecision(applicationId, {
      decisionId: command.decisionId,
      reason: "A changed reason must not overwrite the immutable decision."
    });

    const conflict = await repository().recordHumanDecision({
      command: changed,
      correlationId: generateCorrelationId()
    });

    expect(conflict).toEqual({ ok: false, error: { code: "idempotency_conflict" } });
    expect(await selectAuditRows(applicationId)).toEqual(auditBefore);
    expect(await selectApplicationRow(applicationId)).toEqual(applicationBefore);
  });

  it("rejects a new decision id after terminal approval and keeps one audit row", async () => {
    const applicationId = await createHumanReviewApplication();
    const original = approvedDecision(applicationId);
    await recordApprovedDecision(original);

    const conflict = await repository().recordHumanDecision({
      command: approvedDecision(applicationId),
      correlationId: generateCorrelationId()
    });

    expect(conflict).toEqual({
      ok: false,
      error: { code: "state_conflict", actualState: "approved" }
    });
    expect(await selectAuditRows(applicationId)).toMatchObject([{ decision_id: original.decisionId }]);
  });

  it("returns not_found for an unknown application and creates no audit row", async () => {
    const applicationId = syntheticApplicationId();
    const command = approvedDecision(applicationId);

    const result = await repository().recordHumanDecision({
      command,
      correlationId: generateCorrelationId()
    });

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
    expect(await selectAuditRows(applicationId)).toEqual([]);
  });

  it("denies publishable-key select, insert, and RPC execution with 42501", async () => {
    const applicationId = await createHumanReviewApplication();
    const original = approvedDecision(applicationId);
    await recordApprovedDecision(original);
    const publishable = getPublishableClient();

    const selected = await publishable.from(AUDIT_TABLE).select().eq("application_id", applicationId);
    expect(selected.error?.code).toBe("42501");
    expect(selected.data).toBeNull();

    const inserted = await publishable.from(AUDIT_TABLE).insert({
      decision_id: randomUUID(),
      application_id: applicationId,
      outcome: "approved",
      actor: "unauthorized@example.test",
      reason: "This direct insert must be denied.",
      approved_limit_ars: 1,
      correlation_id: generateCorrelationId()
    });
    expect(inserted.error?.code).toBe("42501");

    const rpc = await publishable.rpc("record_human_decision", {
      p_decision_id: randomUUID(),
      p_application_id: applicationId,
      p_outcome: "approved",
      p_actor: "unauthorized@example.test",
      p_reason: "This RPC call must be denied.",
      p_approved_limit_ars: 1,
      p_correlation_id: generateCorrelationId()
    });
    expect(rpc.error?.code).toBe("42501");
    expect(rpc.data).toBeNull();
    expect(await selectAuditRows(applicationId)).toMatchObject([{ decision_id: original.decisionId }]);
  });

  it("serializes concurrent decision ids so exactly one applies and one sees the terminal state", async () => {
    const applicationId = await createHumanReviewApplication();
    const commands = [approvedDecision(applicationId), approvedDecision(applicationId)] as const;

    const results = await Promise.all(
      commands.map((command) =>
        repository().recordHumanDecision({ command, correlationId: generateCorrelationId() })
      )
    );
    const applied = results.filter((result) => result.ok && result.value.applied);
    const conflicts = results.filter(
      (result) => !result.ok && result.error.code === "state_conflict" && result.error.actualState === "approved"
    );

    expect(applied).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
    const rows = await selectAuditRows(applicationId);
    expect(rows).toHaveLength(1);
    expect(commands.map(({ decisionId }) => decisionId)).toContain(rows[0]?.decision_id);
    expect((await selectApplicationRow(applicationId)).state).toBe("approved");
  });
});
