import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { disclosures, type DisclosureId } from "@/application/trust/disclosures";
import { CanonicalDisclosure } from "./canonical-disclosure";

describe("CanonicalDisclosure", () => {
  for (const id of Object.keys(disclosures) as DisclosureId[]) {
    it(`renders the exact verbatim canonical text for "${id}"`, () => {
      render(<CanonicalDisclosure id={id} />);

      expect(screen.getByText(disclosures[id].text)).toBeInTheDocument();
    });
  }

  it("defaults to lang='es'", () => {
    const { container } = render(<CanonicalDisclosure id="simulation" />);

    expect(container.querySelector("[lang='es']")).toBeInTheDocument();
  });
});
