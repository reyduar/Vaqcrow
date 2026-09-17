import Link from "next/link";
import type { DemoStep } from "@/application/navigation/demo-steps";
import { demoStepHref } from "@/application/navigation/demo-steps";

export interface DemoStepNavProps {
  readonly previous: DemoStep | null;
  readonly next: DemoStep | null;
}

export function DemoStepNav({ previous, next }: DemoStepNavProps) {
  return (
    <nav aria-label="Demo step navigation">
      {previous ? <Link href={demoStepHref(previous.slug)}>{previous.label}</Link> : null}
      {next ? <Link href={demoStepHref(next.slug)}>{next.label}</Link> : null}
    </nav>
  );
}
