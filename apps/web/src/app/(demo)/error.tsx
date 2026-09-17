"use client";

import { DemoStepError } from "@/presentation/components/demo-step-error";

export interface DemoRouteErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function Error({ reset }: DemoRouteErrorProps) {
  return <DemoStepError onRetry={reset} />;
}
