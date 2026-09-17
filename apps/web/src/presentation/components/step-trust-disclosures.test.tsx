import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { demoSteps } from "@/application/navigation/demo-steps";
import { disclosures } from "@/application/trust/disclosures";
import { stepDisclosures } from "@/application/trust/step-disclosures";
import { StepTrustDisclosures } from "./step-trust-disclosures";

describe("StepTrustDisclosures", () => {
  it.each(demoSteps)(
    "renders every required canonical disclosure and note for the $slug step",
    ({ slug }) => {
      render(<StepTrustDisclosures step={slug} />);

      const spec = stepDisclosures[slug];

      for (const id of spec.canonical) {
        expect(screen.getByText(disclosures[id].text)).toBeInTheDocument();
      }
      for (const note of spec.notes) {
        expect(screen.getByText(note)).toBeInTheDocument();
      }
    }
  );
});
