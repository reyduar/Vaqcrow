import type { DemoStep } from "@/application/navigation/demo-steps";

export interface DemoProgressProps {
  readonly step: DemoStep;
  readonly position: number;
  readonly total: number;
}

export function DemoProgress({ step, position, total }: DemoProgressProps) {
  return (
    <nav aria-label="Demo progress">
      <p aria-current="step">
        Step {position} of {total}: {step.label}
      </p>
    </nav>
  );
}
