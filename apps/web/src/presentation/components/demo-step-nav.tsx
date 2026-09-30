"use client";

import Link from "next/link";
import type { DemoStep } from "@/application/navigation/demo-steps";
import { journeyStepHref } from "@/application/navigation/journey-params";
import { useJourneyIds } from "@/state/journey-store-provider";

export interface DemoStepNavProps {
  readonly previous: DemoStep | null;
  readonly next: DemoStep | null;
}

export function DemoStepNav({ previous, next }: DemoStepNavProps) {
  const ids = useJourneyIds();
  return (
    <nav aria-label="Demo step navigation">
      {previous ? <Link href={journeyStepHref(previous.slug, ids)}>{previous.label}</Link> : null}
      {next ? <Link href={journeyStepHref(next.slug, ids)}>{next.label}</Link> : null}
    </nav>
  );
}
