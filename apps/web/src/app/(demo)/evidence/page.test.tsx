import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { disclosures, microcopy } from "@/application/trust/disclosures";

// The page is a client component that reads `?campaign=`/`?distribution=`; the
// route-level disclosure assertions render with neither.
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => null })
}));

import EvidencePage from "./page";

/**
 * Route-scoped disclosure assertions (Feature #17 / Task #54, spec obs #445)
 * plus the T92-04 replacement check: the placeholder is gone and the evidence
 * workspace now renders in its place. Asserts only this route's own content —
 * DEMO/TESTNET header chrome and cross-route co-presence are covered by
 * `trust-disclosures.integration.test.tsx`.
 */
describe("EvidencePage", () => {
  it("renders the full simulation, testnet, non-custody, contract-custody, and no-production disclosure texts verbatim", () => {
    render(<EvidencePage />);

    expect(screen.getByText(disclosures.simulation.text)).toBeInTheDocument();
    expect(screen.getByText(disclosures.testnet.text)).toBeInTheDocument();
    expect(screen.getByText(disclosures["non-custody"].text)).toBeInTheDocument();
    expect(screen.getByText(disclosures["contract-custody"].text)).toBeInTheDocument();
    expect(screen.getByText(disclosures["no-production"].text)).toBeInTheDocument();
  });

  it("renders the custody statement and its honest limits on the panel that evidences refunds", () => {
    render(<EvidencePage />);

    expect(
      screen.getByText(/los aportes los custodia el contrato, no una persona/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/no hay recuperación ni clawback/i)).toBeInTheDocument();
    expect(screen.getByText(/sólo pueden salir por el barrido/i)).toBeInTheDocument();
  });

  it("renders the deterministic-calculation and prior-run-hash microcopy", () => {
    render(<EvidencePage />);

    expect(screen.getByText(microcopy.deterministicCalculation)).toBeInTheDocument();
    expect(screen.getByText(microcopy.priorRunHash)).toBeInTheDocument();
  });

  it("renders no step placeholder: this route carries its own content", () => {
    render(<EvidencePage />);

    expect(screen.queryByText(/Step content coming soon/i)).not.toBeInTheDocument();
  });
});
