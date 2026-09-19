import { describe, expect, it } from "vitest";
import {
  applicationReviewSnapshotSchema,
  applicationReviewStateSchema,
  humanDecisionCommandSchema,
  humanDecisionOutcomeSchema,
  humanDecisionRecordSchema,
  parseHumanDecisionCommand,
  parseHumanDecisionRecord
} from "./index.js";

const VALID_APPLICATION_ID = "123e4567-e89b-42d3-a456-426614174000";
const VALID_DECISION_ID = "01890f3e-7b1a-4c2d-8e3f-123456789abc";
const VALID_CORRELATION_ID = "87654321-4321-4abc-8def-123456789abc";

const validCommand = {
  decisionId: VALID_DECISION_ID,
  applicationId: VALID_APPLICATION_ID,
  outcome: "approved",
  actor: "reviewer@example.com",
  reason: "The evidence supports the requested financing.",
  approvedLimitArs: 5_000_000
} as const;

const validRecord = {
  ...validCommand,
  decidedAt: "2026-09-19T10:30:00-03:00",
  correlationId: VALID_CORRELATION_ID
} as const;

describe("applicationReviewStateSchema", () => {
  it.each([
    "draft",
    "awaiting_assessment",
    "human_review",
    "approved",
    "changes_requested",
    "rejected"
  ])("accepts the known state %s", (state) => {
    expect(applicationReviewStateSchema.safeParse(state).success).toBe(true);
  });

  it.each([
    ["near-miss casing of a known state", "Draft"],
    ["near-miss casing of a known state", "APPROVED"],
    ["near-miss spelling of a known state", "drafts"],
    ["near-miss spelling of a known state", "awaiting_assesment"],
    ["near-miss spelling of a known state", "human-review"],
    ["an empty string", ""],
    ["an unrelated value", "not_a_state"],
    ["an unrelated value", "pending"],
    ["a numeric value", 1],
    ["a boolean value", true],
    ["a null value", null]
  ])("rejects %s: %j", (_description, value) => {
    expect(applicationReviewStateSchema.safeParse(value).success).toBe(false);
  });
});

describe("applicationReviewSnapshotSchema", () => {
  it("parses a valid snapshot with no extra keys", () => {
    const result = applicationReviewSnapshotSchema.safeParse({
      applicationId: VALID_APPLICATION_ID,
      state: "draft"
    });

    expect(result.success).toBe(true);
  });

  it.each([
    ["missing applicationId", { state: "draft" }],
    ["missing state", { applicationId: VALID_APPLICATION_ID }]
  ])("rejects a snapshot %s", (_description, input) => {
    expect(applicationReviewSnapshotSchema.safeParse(input).success).toBe(false);
  });

  it("rejects a snapshot carrying one extra unknown key", () => {
    const result = applicationReviewSnapshotSchema.safeParse({
      applicationId: VALID_APPLICATION_ID,
      state: "draft",
      extra: "unexpected"
    });

    expect(result.success).toBe(false);
  });
});

describe("humanDecisionOutcomeSchema", () => {
  it("accepts exactly the three human decision outcomes", () => {
    expect(humanDecisionOutcomeSchema.options).toEqual([
      "approved",
      "changes_requested",
      "rejected"
    ]);
  });
});

describe("humanDecisionCommandSchema", () => {
  it.each([
    ["approve", "approved", 5_000_000],
    ["request changes", "changes_requested", null],
    ["reject", "rejected", null]
  ] as const)("parses a valid %s command", (_description, outcome, approvedLimitArs) => {
    const parsed = parseHumanDecisionCommand({
      ...validCommand,
      outcome,
      approvedLimitArs
    });

    expect(parsed.outcome).toBe(outcome);
    expect(parsed.approvedLimitArs).toBe(approvedLimitArs);
  });

  it("trims actor and reason before returning the command", () => {
    const parsed = parseHumanDecisionCommand({
      ...validCommand,
      actor: "  reviewer@example.com  ",
      reason: "  Evidence verified.  "
    });

    expect(parsed.actor).toBe("reviewer@example.com");
    expect(parsed.reason).toBe("Evidence verified.");
  });

  it.each(Object.keys(validCommand))("rejects a command missing %s", (key) => {
    const input: Record<string, unknown> = { ...validCommand };
    delete input[key];

    expect(humanDecisionCommandSchema.safeParse(input).success).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      humanDecisionCommandSchema.safeParse({ ...validCommand, extra: "unexpected" }).success
    ).toBe(false);
  });

  it.each([
    ["an empty actor", { actor: "   " }],
    ["an actor over 120 characters", { actor: "a".repeat(121) }],
    ["an empty reason", { reason: "   " }],
    ["a reason over 1,000 characters", { reason: "r".repeat(1001) }],
    ["a malformed decision ID", { decisionId: "not-a-uuid" }],
    ["a malformed application ID", { applicationId: "not-a-uuid" }]
  ])("rejects %s", (_description, override) => {
    expect(humanDecisionCommandSchema.safeParse({ ...validCommand, ...override }).success).toBe(
      false
    );
  });

  it.each([
    ["approved with null", "approved", null],
    ["changes requested with a limit", "changes_requested", 1],
    ["rejected with a limit", "rejected", 1],
    ["approved with zero", "approved", 0],
    ["approved with a negative limit", "approved", -1],
    ["approved with a fractional limit", "approved", 1.5],
    ["approved with an unsafe integer", "approved", Number.MAX_SAFE_INTEGER + 1]
  ] as const)("rejects %s", (_description, outcome, approvedLimitArs) => {
    expect(
      humanDecisionCommandSchema.safeParse({
        ...validCommand,
        outcome,
        approvedLimitArs
      }).success
    ).toBe(false);
  });
});

describe("humanDecisionRecordSchema", () => {
  it.each([
    ["approve", "approved", 5_000_000],
    ["request changes", "changes_requested", null],
    ["reject", "rejected", null]
  ] as const)("parses a valid %s record", (_description, outcome, approvedLimitArs) => {
    const parsed = parseHumanDecisionRecord({
      ...validRecord,
      outcome,
      approvedLimitArs
    });

    expect(parsed.outcome).toBe(outcome);
    expect(parsed.decidedAt).toBe(validRecord.decidedAt);
  });

  it.each([
    ["a malformed decision ID", { decisionId: "not-a-uuid" }],
    ["a malformed application ID", { applicationId: "not-a-uuid" }],
    ["a malformed correlation ID", { correlationId: "not-a-uuid" }],
    ["a local datetime without an offset", { decidedAt: "2026-09-19T10:30:00" }],
    ["a malformed datetime", { decidedAt: "September 19, 2026" }]
  ])("rejects %s", (_description, override) => {
    expect(humanDecisionRecordSchema.safeParse({ ...validRecord, ...override }).success).toBe(
      false
    );
  });

  it.each(["decidedAt", "correlationId"])("rejects a record missing %s", (key) => {
    const input: Record<string, unknown> = { ...validRecord };
    delete input[key];

    expect(humanDecisionRecordSchema.safeParse(input).success).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      humanDecisionRecordSchema.safeParse({ ...validRecord, extra: "unexpected" }).success
    ).toBe(false);
  });

  it("preserves the command limit invariant", () => {
    expect(
      humanDecisionRecordSchema.safeParse({
        ...validRecord,
        outcome: "rejected",
        approvedLimitArs: 1
      }).success
    ).toBe(false);
  });
});
