import { describe, expect, expectTypeOf, it } from "vitest";
import {
  applicationReviewStates,
  canTransitionApplicationReview,
  decideApplicationReview,
  humanDecisionOutcomes,
  isTerminalApplicationReviewState,
  terminalApplicationReviewStates,
  transitionApplicationReview
} from "./application-review.js";
import type { ApplicationReviewState, HumanDecisionOutcome } from "./application-review.js";

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

describe("transitionApplicationReview — exhaustive 36-pair matrix", () => {
  // Independent, hand-authored oracle. MUST NOT call canTransitionApplicationReview
  // or isTerminalApplicationReviewState — those are the implementation under test.
  const ALLOWED = new Set<string>([
    "draft->awaiting_assessment",
    "awaiting_assessment->human_review",
    "human_review->approved",
    "human_review->changes_requested",
    "human_review->rejected",
    "changes_requested->draft"
  ]);
  const TERMINAL_ORACLE: readonly string[] = ["approved", "rejected"];

  const transitionPairs = applicationReviewStates.flatMap((from) =>
    applicationReviewStates.map(
      (to): [ApplicationReviewState, ApplicationReviewState] => [from, to]
    )
  );

  function expected(
    from: ApplicationReviewState,
    to: ApplicationReviewState
  ): ReturnType<typeof transitionApplicationReview> {
    if (ALLOWED.has(`${from}->${to}`)) {
      return { ok: true, state: to };
    }

    return {
      ok: false,
      error: {
        code: TERMINAL_ORACLE.includes(from) ? "terminal_state" : "invalid_transition",
        from,
        to
      }
    };
  }

  it("covers exactly 36 unique pairs with 6 allowed edges", () => {
    expect(transitionPairs).toHaveLength(36);

    const uniqueKeys = new Set(transitionPairs.map(([from, to]) => `${from}->${to}`));
    expect(uniqueKeys.size).toBe(36);
    expect(ALLOWED.size).toBe(6);
  });

  it.each<[ApplicationReviewState, ApplicationReviewState]>(transitionPairs)(
    "%s -> %s",
    (from, to) => {
      expect(transitionApplicationReview(from, to)).toEqual(expected(from, to));
    }
  );

  it("leaves the exported state literals unchanged after the matrix ran", () => {
    expect(applicationReviewStates).toEqual([
      "draft",
      "awaiting_assessment",
      "human_review",
      "approved",
      "changes_requested",
      "rejected"
    ]);
    expect(terminalApplicationReviewStates).toEqual(["approved", "rejected"]);
  });
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

describe("decideApplicationReview", () => {
  it("exposes exactly the three human decision outcomes", () => {
    expect(humanDecisionOutcomes).toEqual(["approved", "changes_requested", "rejected"]);
    expectTypeOf<Parameters<typeof decideApplicationReview>[1]>().toEqualTypeOf<HumanDecisionOutcome>();
  });

  it.each(humanDecisionOutcomes)("accepts %s from human review", (outcome) => {
    expect(decideApplicationReview("human_review", outcome)).toEqual({
      ok: true,
      state: outcome
    });
  });

  const nonHumanReviewStates = applicationReviewStates.filter(
    (state): state is Exclude<ApplicationReviewState, "human_review"> => state !== "human_review"
  );
  const rejectedDecisionPairs = nonHumanReviewStates.flatMap((from) =>
    humanDecisionOutcomes.map((outcome): [ApplicationReviewState, HumanDecisionOutcome] => [
      from,
      outcome
    ])
  );

  it.each(rejectedDecisionPairs)("rejects the human outcome %s -> %s", (from, outcome) => {
    expect(decideApplicationReview(from, outcome)).toEqual({
      ok: false,
      error: {
        code: terminalApplicationReviewStates.includes(
          from as (typeof terminalApplicationReviewStates)[number]
        )
          ? "terminal_state"
          : "invalid_transition",
        from,
        to: outcome
      }
    });
  });
});
