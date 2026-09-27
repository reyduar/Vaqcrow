import { Button } from "./button";

/**
 * ErrorState primitive (Issue #310 / T1): title/message plus a retry action
 * rendered through the shared `Button`, in `role="alert"` so assistive tech
 * announces it immediately. Meaning lives in the text (title + message),
 * never only in the `--color-trust-critical` tint used for the panel.
 */
export interface ErrorStateProps {
  readonly title: string;
  readonly message: string;
  readonly onRetry: () => void;
  readonly retryLabel?: string;
  readonly className?: string;
}

export function ErrorState({ title, message, onRetry, retryLabel = "Reintentar", className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-start gap-3 rounded-2xl border border-trust-critical/30 bg-trust-critical/10 p-6 text-trust-critical ${className ?? ""}`.trim()}
    >
      <p className="text-base font-semibold">{title}</p>
      <p className="text-sm">{message}</p>
      <Button variant="secondary" onPress={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}
