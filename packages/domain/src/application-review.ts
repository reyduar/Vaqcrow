export const applicationReviewStates = [
  "draft",
  "awaiting_assessment",
  "human_review",
  "approved",
  "changes_requested",
  "rejected"
] as const;

export type ApplicationReviewState = (typeof applicationReviewStates)[number];

export const humanDecisionOutcomes = ["approved", "changes_requested", "rejected"] as const;

export type HumanDecisionOutcome = (typeof humanDecisionOutcomes)[number];

export const terminalApplicationReviewStates = ["approved", "rejected"] as const;

export type ApplicationReviewTransitionErrorCode = "invalid_transition" | "terminal_state";

export interface ApplicationReviewTransitionError {
  readonly code: ApplicationReviewTransitionErrorCode;
  readonly from: ApplicationReviewState;
  readonly to: ApplicationReviewState;
}

export type ApplicationReviewTransitionResult =
  | { readonly ok: true; readonly state: ApplicationReviewState }
  | { readonly ok: false; readonly error: ApplicationReviewTransitionError };

const allowedTransitions: Record<ApplicationReviewState, readonly ApplicationReviewState[]> = {
  draft: ["awaiting_assessment"],
  awaiting_assessment: ["human_review"],
  human_review: ["approved", "changes_requested", "rejected"],
  approved: [],
  changes_requested: ["draft"],
  rejected: []
};

export function isTerminalApplicationReviewState(state: ApplicationReviewState): boolean {
  return (terminalApplicationReviewStates as readonly ApplicationReviewState[]).includes(state);
}

export function canTransitionApplicationReview(
  from: ApplicationReviewState,
  to: ApplicationReviewState
): boolean {
  return allowedTransitions[from].includes(to);
}

export function transitionApplicationReview(
  from: ApplicationReviewState,
  to: ApplicationReviewState
): ApplicationReviewTransitionResult {
  if (canTransitionApplicationReview(from, to)) {
    return { ok: true, state: to };
  }

  const code: ApplicationReviewTransitionErrorCode = isTerminalApplicationReviewState(from)
    ? "terminal_state"
    : "invalid_transition";

  return { ok: false, error: { code, from, to } };
}

export function decideApplicationReview(
  from: ApplicationReviewState,
  outcome: HumanDecisionOutcome
): ApplicationReviewTransitionResult {
  return transitionApplicationReview(from, outcome);
}
