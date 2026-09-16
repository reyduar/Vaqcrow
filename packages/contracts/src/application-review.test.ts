import { describe, expect, it } from "vitest";
import { applicationReviewSnapshotSchema, applicationReviewStateSchema } from "./index.js";

const VALID_APPLICATION_ID = "123e4567-e89b-42d3-a456-426614174000";

describe("applicationReviewStateSchema", () => {
  it("parses a known state", () => {
    expect(applicationReviewStateSchema.safeParse("human_review").success).toBe(true);
  });

  it("rejects an arbitrary string not among the six states", () => {
    expect(applicationReviewStateSchema.safeParse("not_a_state").success).toBe(false);
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
