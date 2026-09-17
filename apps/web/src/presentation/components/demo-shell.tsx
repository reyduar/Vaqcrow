"use client";

import type { ReactNode } from "react";
import { useDemoStep } from "@/state/use-demo-step";
import { DemoEnvironmentHeader } from "./demo-environment-header";
import { DemoProgress } from "./demo-progress";
import { DemoStepNav } from "./demo-step-nav";

export interface DemoShellProps {
  readonly children: ReactNode;
}

export function DemoShell({ children }: DemoShellProps) {
  const demoStep = useDemoStep();

  return (
    <div>
      <DemoEnvironmentHeader />
      {demoStep ? (
        <>
          <h1>{demoStep.step.label}</h1>
          <DemoProgress step={demoStep.step} position={demoStep.position} total={demoStep.total} />
        </>
      ) : null}
      {children}
      {demoStep ? <DemoStepNav previous={demoStep.previous} next={demoStep.next} /> : null}
    </div>
  );
}
