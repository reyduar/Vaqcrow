"use client";

import { usePathname } from "next/navigation";
import type { DemoStep } from "@/application/navigation/demo-steps";
import {
  demoStepAdjacency,
  demoStepCount,
  demoStepPosition,
  demoSteps,
  isDemoStepSlug
} from "@/application/navigation/demo-steps";

export interface DemoStepViewModel {
  readonly step: DemoStep;
  readonly position: number;
  readonly total: number;
  readonly previous: DemoStep | null;
  readonly next: DemoStep | null;
}

function lastPathSegment(pathname: string): string {
  const withoutTrailingSlashes = pathname.replace(/\/+$/, "");
  const segments = withoutTrailingSlashes.split("/");
  return segments[segments.length - 1] ?? "";
}

export function useDemoStep(): DemoStepViewModel | null {
  const pathname = usePathname();
  const slug = lastPathSegment(pathname);

  if (!isDemoStepSlug(slug)) {
    return null;
  }

  const step = demoSteps.find((candidate) => candidate.slug === slug);
  if (!step) {
    return null;
  }

  const { previous, next } = demoStepAdjacency(slug);

  return {
    step,
    position: demoStepPosition(slug),
    total: demoStepCount,
    previous,
    next
  };
}
