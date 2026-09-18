import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { disclosures, microcopy } from "@/application/trust/disclosures";
import EvidencePage from "./page";

/**
 * Route-scoped disclosure assertions (Feature #17 / Task #54, spec obs #445).
 * Asserts only this route's own content — DEMO/TESTNET header chrome and
 * cross-route co-presence are covered by `trust-disclosures.integration.test.tsx`.
 */
describe("EvidencePage", () => {
  it("renders the full simulation, testnet, non-custody, and no-production disclosure texts verbatim", () => {
    render(<EvidencePage />);

    expect(screen.getByText(disclosures.simulation.text)).toBeInTheDocument();
    expect(screen.getByText(disclosures.testnet.text)).toBeInTheDocument();
    expect(screen.getByText(disclosures["non-custody"].text)).toBeInTheDocument();
    expect(screen.getByText(disclosures["no-production"].text)).toBeInTheDocument();
  });

  it("renders the deterministic-calculation and prior-run-hash microcopy", () => {
    render(<EvidencePage />);

    expect(screen.getByText(microcopy.deterministicCalculation)).toBeInTheDocument();
    expect(screen.getByText(microcopy.priorRunHash)).toBeInTheDocument();
  });
});
