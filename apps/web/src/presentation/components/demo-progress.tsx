import type { DemoStep } from "@/application/navigation/demo-steps";

export interface DemoProgressProps {
  readonly step: DemoStep;
  readonly position: number;
  readonly total: number;
}

export function DemoProgress({ step, position, total }: DemoProgressProps) {
  return (
    <nav aria-label="Progreso de la demo">
      {/*
        Template page-header eyebrow (`Vaqcrow Portafolio.dc.html` / `Vaqcrow
        Informes.dc.html` above the `<h1>`): small, uppercase, `--text2`. The
        step copy itself is unchanged — the text carries the meaning, the
        casing and weight only style it.
      */}
      <p
        aria-current="step"
        className="m-0 text-xs font-semibold tracking-[0.08em] text-text-secondary uppercase"
      >
        Paso {position} de {total}: {step.label}
      </p>
    </nav>
  );
}
