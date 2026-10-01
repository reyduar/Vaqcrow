import type { DemoStep } from "@/application/navigation/demo-steps";

export interface DemoProgressProps {
  readonly step: DemoStep;
  readonly position: number;
  readonly total: number;
}

export function DemoProgress({ step, position, total }: DemoProgressProps) {
  return (
    <nav aria-label="Progreso de la demo">
      <p aria-current="step">
        Paso {position} de {total}: {step.label}
      </p>
    </nav>
  );
}
