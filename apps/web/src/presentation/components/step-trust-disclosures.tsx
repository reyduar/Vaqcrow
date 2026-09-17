import type { DemoStepSlug } from "@/application/navigation/demo-steps";
import { stepDisclosures } from "@/application/trust/step-disclosures";
import { CanonicalDisclosure } from "./canonical-disclosure";

/**
 * StepTrustDisclosures (Feature #17 / Task #53): the per-route composition
 * point for trust disclosures. Reads `application/trust/step-disclosures.ts`
 * for the given `step` and renders every required canonical `TrustBanner`
 * (via `CanonicalDisclosure`) plus every required contextual microcopy note.
 *
 * Composed BESIDE `StepPlaceholder` in each `(demo)/*\/page.tsx`, never
 * nested inside it — `StepPlaceholder` stays byte-identical and is slated
 * for deletion when #18/#19 add real content (design Decision B).
 */
export interface StepTrustDisclosuresProps {
  readonly step: DemoStepSlug;
}

export function StepTrustDisclosures({ step }: StepTrustDisclosuresProps) {
  const spec = stepDisclosures[step];

  return (
    <section aria-label="Trust disclosures" lang="es">
      {spec.canonical.map((id) => (
        <CanonicalDisclosure key={id} id={id} />
      ))}
      {spec.notes.map((note) => (
        <p key={note}>{note}</p>
      ))}
    </section>
  );
}
