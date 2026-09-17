import { describe, expect, it } from "vitest";
import {
  applicationReviewStates,
  transitionApplicationReview
} from "@vaqcrow/domain";
import type { ApplicationReviewState } from "@vaqcrow/domain";
import {
  applicationReviewStateSchema,
  parseApplicationReviewSnapshot
} from "@vaqcrow/contracts";
import type { ApplicationReviewSnapshot } from "@vaqcrow/contracts";

const VALID_APPLICATION_ID = "123e4567-e89b-42d3-a456-426614174000";

function advance(
  snapshot: ApplicationReviewSnapshot,
  to: ApplicationReviewState
): ApplicationReviewSnapshot {
  const result = transitionApplicationReview(snapshot.state, to);

  expect(result).toEqual({ ok: true, state: to });
  if (!result.ok) {
    throw new Error("unreachable: asserted ok above");
  }

  const next = parseApplicationReviewSnapshot({
    applicationId: snapshot.applicationId,
    state: result.state
  });

  expect(next).not.toBe(snapshot);
  expect(next.state).toBe(to);
  expect(next.applicationId).toBe(snapshot.applicationId);
  expect(snapshot.state).not.toBe(to);

  return next;
}

describe("application review cross-package round-trip", () => {
  it.each<[string, readonly ApplicationReviewState[]]>([
    ["approved path", ["awaiting_assessment", "human_review", "approved"]],
    [
      "changes_requested/draft recovery path",
      ["awaiting_assessment", "human_review", "changes_requested", "draft"]
    ],
    ["rejected path", ["awaiting_assessment", "human_review", "rejected"]]
  ])("walks the %s through contracts -> domain -> contracts", (_description, path) => {
    let snapshot = parseApplicationReviewSnapshot({
      applicationId: VALID_APPLICATION_ID,
      state: "draft"
    });

    for (const to of path) {
      snapshot = advance(snapshot, to);
    }

    const final = snapshot;
    const lastStep = path[path.length - 1];

    if (lastStep === "approved" || lastStep === "rejected") {
      expect(transitionApplicationReview(final.state, "draft")).toEqual({
        ok: false,
        error: { code: "terminal_state", from: final.state, to: "draft" }
      });
    }

    expect(parseApplicationReviewSnapshot(final)).toEqual(final);
  });

  it("proves the contracts state schema accepts exactly the domain's state vocabulary", () => {
    expect(applicationReviewStateSchema.options).toEqual([...applicationReviewStates]);
  });
});
