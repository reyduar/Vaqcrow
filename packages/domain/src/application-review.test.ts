import { describe, expect, it } from "vitest";
import {
  applicationReviewStates,
  canTransitionApplicationReview,
  isTerminalApplicationReviewState,
  terminalApplicationReviewStates,
  transitionApplicationReview
} from "./application-review.js";
import type { ApplicationReviewState } from "./application-review.js";

describe("applicationReviewStates", () => {
  it("contains exactly the six named states and no others", () => {
    expect(applicationReviewStates).toEqual([
      "draft",
      "awaiting_assessment",
      "human_review",
      "approved",
      "changes_requested",
      "rejected"
    ]);
    expect(applicationReviewStates).toHaveLength(6);
  });
});

describe("transitionApplicationReview — allowed transitions", () => {
  it.each<[ApplicationReviewState, ApplicationReviewState]>([
    ["draft", "awaiting_assessment"],
    ["awaiting_assessment", "human_review"],
    ["human_review", "approved"],
    ["human_review", "changes_requested"],
    ["human_review", "rejected"],
    ["changes_requested", "draft"]
  ])("allows %s -> %s", (from, to) => {
    const result = transitionApplicationReview(from, to);

    expect(result).toEqual({ ok: true, state: to });
  });

  it("allows changes_requested -> draft as a recovery path", () => {
    const result = transitionApplicationReview("changes_requested", "draft");

    expect(result).toEqual({ ok: true, state: "draft" });
  });
});

describe("transitionApplicationReview — invalid transitions", () => {
  it("rejects draft -> approved with an invalid_transition error and no mutation", () => {
    const from: ApplicationReviewState = "draft";
    const result = transitionApplicationReview(from, "approved");

    expect(result).toEqual({
      ok: false,
      error: { code: "invalid_transition", from: "draft", to: "approved" }
    });
    expect(from).toBe("draft");
  });

  it.each<ApplicationReviewState>(["approved", "rejected"])(
    "rejects any transition attempted from the terminal state %s",
    (from) => {
      const result = transitionApplicationReview(from, "draft");

      expect(result).toEqual({
        ok: false,
        error: { code: "terminal_state", from, to: "draft" }
      });
    }
  );
});

describe("terminalApplicationReviewStates / isTerminalApplicationReviewState", () => {
  it("marks approved and rejected as terminal, and no other state", () => {
    expect(terminalApplicationReviewStates).toEqual(["approved", "rejected"]);

    for (const state of applicationReviewStates) {
      const expected = terminalApplicationReviewStates.includes(
        state as (typeof terminalApplicationReviewStates)[number]
      );
      expect(isTerminalApplicationReviewState(state)).toBe(expected);
    }
  });
});

describe("canTransitionApplicationReview", () => {
  it("returns true for allowed transitions and false for disallowed ones", () => {
    expect(canTransitionApplicationReview("draft", "awaiting_assessment")).toBe(true);
    expect(canTransitionApplicationReview("draft", "approved")).toBe(false);
    expect(canTransitionApplicationReview("approved", "draft")).toBe(false);
  });
});
