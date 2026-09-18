import { describe, expect, it } from "vitest";
import type { DemoStepSlug } from "../navigation/demo-steps";
import type { DisclosureId } from "./disclosures";
import { stepDisclosures } from "./step-disclosures";

/**
 * Independently-pinned per-route disclosure containment (Feature #17 / Task
 * #54). This table is HAND-COPIED from spec obs #429's "Per-Step Disclosure
 * Placement" table — it is never derived by importing or reading
 * `stepDisclosures` itself, which would make the assertion circular. Every
 * route's real `stepDisclosures[route].canonical` MUST be a superset of the
 * ids listed here; extra ids beyond this minimum are legitimate and MUST NOT
 * fail the check (containment, not equality).
 */
const requiredByRoute: Readonly<Record<DemoStepSlug, readonly DisclosureId[]>> = {
  request: ["simulation"],
  "ai-assessment": ["human-ai"],
  approval: ["human-ai"],
  funding: ["testnet", "non-custody"],
  distribution: ["testnet"],
  evidence: ["simulation", "testnet", "non-custody", "no-production"]
};

describe("stepDisclosures — independently-pinned containment", () => {
  it.each(Object.entries(requiredByRoute) as Array<[DemoStepSlug, readonly DisclosureId[]]>)(
    "route %s carries at least the spec-required disclosure ids",
    (route, required) => {
      expect(stepDisclosures[route].canonical).toEqual(expect.arrayContaining([...required]));
    }
  );

  it("allows a legitimate superset — extra ids beyond the spec minimum do not fail the check", () => {
    // distribution's real module carries "testnet" plus other content
    // (contextual notes), never fewer than the spec minimum. This proves the
    // containment check accepts a superset rather than demanding equality.
    const distributionRequired = requiredByRoute.distribution;

    expect(stepDisclosures.distribution.canonical.length).toBeGreaterThanOrEqual(distributionRequired.length);
    expect(stepDisclosures.distribution.canonical).toEqual(expect.arrayContaining([...distributionRequired]));

    // A synthetic superset (spec minimum plus an extra id) must also pass
    // the same containment style of assertion used above.
    const syntheticSuperset: readonly DisclosureId[] = [...distributionRequired, "human-ai"];

    expect(syntheticSuperset).toEqual(expect.arrayContaining([...distributionRequired]));
  });

  it("fails when a required id is dropped from a route's canonical set", () => {
    const withoutHumanAi: readonly DisclosureId[] = stepDisclosures["ai-assessment"].canonical.filter(
      (id) => id !== "human-ai"
    );

    expect(withoutHumanAi).not.toEqual(expect.arrayContaining([...requiredByRoute["ai-assessment"]]));
  });
});
