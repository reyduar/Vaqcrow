import type { DemoStepSlug } from "../navigation/demo-steps";
import { type DisclosureId, microcopy } from "./disclosures";

/**
 * Which canonical disclosures and contextual microcopy apply at a given demo
 * route, per the spec's "Per-Step Disclosure Placement" requirement and
 * `docs/design/demo-ui.md` §8 (pantallas 2–6).
 */
export interface StepDisclosureSpec {
  /** Full canonical banners required at this step, in render order. */
  readonly canonical: readonly DisclosureId[];
  /** Contextual microcopy values required at this step, verbatim. */
  readonly notes: readonly string[];
}

export const stepDisclosures: Readonly<Record<DemoStepSlug, StepDisclosureSpec>> = Object.freeze({
  request: Object.freeze({
    canonical: Object.freeze(["simulation"] as const),
    notes: Object.freeze([microcopy.kycSimulated, microcopy.salesSynthetic])
  }),
  "ai-assessment": Object.freeze({
    canonical: Object.freeze(["human-ai"] as const),
    notes: Object.freeze([microcopy.humanDecision])
  }),
  approval: Object.freeze({
    canonical: Object.freeze(["human-ai"] as const),
    notes: Object.freeze([microcopy.humanDecision])
  }),
  funding: Object.freeze({
    canonical: Object.freeze(["testnet", "non-custody"] as const),
    notes: Object.freeze([microcopy.testAssetNoValue, microcopy.preSignCheck])
  }),
  distribution: Object.freeze({
    canonical: Object.freeze(["testnet"] as const),
    notes: Object.freeze([microcopy.submittedNotConfirmed, microcopy.hashTechnicalOnly])
  }),
  evidence: Object.freeze({
    canonical: Object.freeze(["simulation", "testnet", "non-custody", "no-production"] as const),
    notes: Object.freeze([microcopy.deterministicCalculation, microcopy.priorRunHash])
  })
});
