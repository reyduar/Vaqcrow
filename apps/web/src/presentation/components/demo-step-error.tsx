import { ErrorState } from "./error-state";

/**
 * Demo route-group error fallback (`app/(demo)/error.tsx`). Adopted
 * (Issue #310 / T3) onto the shared `ErrorState` primitive instead of a
 * plain `<section role="alert">`: `ErrorState` already renders its own
 * single `role="alert"` region, so this stays unwrapped to avoid a
 * duplicate alert. Same visible text ("Something went wrong loading this
 * step.") as a title-only error (no second detail line — `message` is
 * optional on `ErrorState`, see T3 note there), same "Retry" retry-button
 * name, same `onRetry` contract.
 */
export interface DemoStepErrorProps {
  readonly onRetry: () => void;
}

export function DemoStepError({ onRetry }: DemoStepErrorProps) {
  return (
    <ErrorState title="Something went wrong loading this step." onRetry={onRetry} retryLabel="Retry" />
  );
}
