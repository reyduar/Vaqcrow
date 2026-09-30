import { render as rtlRender, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { disclosures, microcopy } from "@/application/trust/disclosures";

// The workspace's own behaviour has its own suite; the page's own wiring — it
// renders the workspace inside the journey — is what these tests prove. The
// probe shows the ids the journey holds, as the workspace reads them.
vi.mock("@/presentation/components/evidence-workspace", async () => {
  const { useJourneyStore } = await import("@/state/journey-store-provider");
  return {
    EvidenceWorkspace: () => {
      const campaignId = useJourneyStore((state) => state.campaignId);
      const distributionId = useJourneyStore((state) => state.distributionId);
      return <p>{`campaign:${campaignId ?? "sin referencia"} distribution:${distributionId ?? "sin referencia"}`}</p>;
    }
  };
});

import type { JourneyIds } from "@/state/journey-store";
import { JourneyStoreProvider } from "@/state/journey-store-provider";
import EvidencePage from "./page";

const APP = "5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f";

const render = (ui: ReactElement, initial: Partial<JourneyIds> = { applicationId: APP }) =>
  rtlRender(<JourneyStoreProvider initial={initial}>{ui}</JourneyStoreProvider>);

/**
 * Route-scoped disclosure assertions (Feature #17 / Task #54, spec obs #445)
 * plus the T92-04 replacement check: the placeholder is gone and the evidence
 * workspace now renders in its place. Asserts only this route's own content —
 * DEMO/TESTNET header chrome and cross-route co-presence are covered by
 * `trust-disclosures.integration.test.tsx`.
 *
 * The journey wiring: the ids the journey carried reach the workspace unchanged,
 * and a missing id stays a declared absence rather than being swallowed.
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

  it("shows the campaign and distribution the journey holds, so a shared link renders the same run", () => {
    const campaignId = "123e4567-e89b-42d3-a456-4266141740ab";
    const distributionId = "223e4567-e89b-42d3-a456-4266141740ab";

    render(<EvidencePage />, { applicationId: APP, campaignId, distributionId });

    expect(screen.getByText(`campaign:${campaignId} distribution:${distributionId}`)).toBeInTheDocument();
  });

  it("declares both ids absent when the journey holds neither", () => {
    render(<EvidencePage />);

    expect(screen.getByText("campaign:sin referencia distribution:sin referencia")).toBeInTheDocument();
  });
});
