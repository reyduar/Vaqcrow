import { describe, expect, it } from "vitest";
import { applicationReviewSnapshotSchema, applicationReviewStateSchema } from "./index.js";

const VALID_APPLICATION_ID = "123e4567-e89b-42d3-a456-426614174000";

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
