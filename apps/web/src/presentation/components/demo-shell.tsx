"use client";

import type { ReactNode } from "react";
import { useDemoStep } from "@/state/use-demo-step";
import { DemoProgress } from "./demo-progress";
import { DemoStepNav } from "./demo-step-nav";

export interface DemoShellProps {
  readonly children: ReactNode;
}

export function DemoShell({ children }: DemoShellProps) {
  const demoStep = useDemoStep();

  if (!demoStep) {
    return <>{children}</>;
  }

  return (
    <div>
      <h1>{demoStep.step.label}</h1>
      <DemoProgress step={demoStep.step} position={demoStep.position} total={demoStep.total} />
      {children}
      <DemoStepNav previous={demoStep.previous} next={demoStep.next} />
    </div>
  );
}
