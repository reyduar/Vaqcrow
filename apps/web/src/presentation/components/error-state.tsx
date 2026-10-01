import { Button } from "./button";

/**
 * ErrorState primitive (Issue #310 / T1-T3): title plus an optional detail
 * message and a retry action rendered through the shared `Button`, in
 * `role="alert"` so assistive tech announces it immediately. Meaning lives in
 * the text (title, and message when present), never only in the
 * `--color-trust-critical` tint used for the panel.
 *
 * `message` is optional (T3, `demo-step-error` adoption): a single-line error
 * has only a title and no second line of detail, so the message paragraph is
 * omitted entirely rather than rendered empty.
 */
export interface ErrorStateProps {
  readonly title: string;
  readonly message?: string;
  readonly onRetry: () => void;
  readonly retryLabel?: string;
  readonly className?: string;
}

export function ErrorState({ title, message, onRetry, retryLabel = "Reintentar", className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-start gap-3 rounded-card bg-trust-critical-surface p-6 text-trust-critical ${className ?? ""}`.trim()}
    >
      <p className="text-base font-semibold">{title}</p>
      {message ? <p className="text-sm">{message}</p> : null}
      <Button variant="secondary" onPress={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}
