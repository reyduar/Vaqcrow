import type { DemoStepSlug } from "@/application/navigation/demo-steps";
import { stepDisclosures } from "@/application/trust/step-disclosures";
import { CanonicalDisclosure } from "./canonical-disclosure";

/**
 * StepTrustDisclosures (Feature #17 / Task #53): the per-route composition
 * point for trust disclosures. Reads `application/trust/step-disclosures.ts`
 * for the given `step` and renders every required canonical `TrustBanner`
 * (via `CanonicalDisclosure`) plus every required contextual microcopy note.
 *
 * Composed first, BESIDE each `(demo)/*\/page.tsx`'s own content, never
 * nested inside it. The former `StepPlaceholder` was deleted once every route
 * had real content (Feature #28 and #29).
 */
export interface StepTrustDisclosuresProps {
  readonly step: DemoStepSlug;
}

export function StepTrustDisclosures({ step }: StepTrustDisclosuresProps) {
  const spec = stepDisclosures[step];

  return (
    <section aria-label="Trust disclosures" lang="es" className="flex flex-col gap-3">
      {spec.canonical.map((id) => (
        <CanonicalDisclosure key={id} id={id} />
      ))}
      {spec.notes.map((note) => (
        <p key={note} className="m-0 text-sm text-text-secondary">
          {note}
        </p>
      ))}
    </section>
  );
}
