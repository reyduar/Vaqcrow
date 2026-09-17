export interface DemoStepErrorProps {
  readonly onRetry: () => void;
}

export function DemoStepError({ onRetry }: DemoStepErrorProps) {
  return (
    <section role="alert">
      <p>Something went wrong loading this step.</p>
      <button type="button" onClick={onRetry}>
        Retry
      </button>
    </section>
  );
}
