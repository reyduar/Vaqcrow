import { render as rtlRender, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { disclosures, microcopy } from "@/application/trust/disclosures";

import { JourneyStoreProvider } from "@/state/journey-store-provider";
import FundingPage from "./page";

const APP = "5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f";
const CAMPAIGN = "11111111-1111-4111-8111-111111111111";

/** The journey as the approval step leaves it: an application, no campaign yet. */
const render = (ui: ReactElement) =>
  rtlRender(<JourneyStoreProvider initial={{ applicationId: APP }}>{ui}</JourneyStoreProvider>);

/**
 * Route-scoped disclosure assertions (Feature #17 / Task #54, spec obs #445)
 * plus the U6 replacement check: the classic funding-intent workspace is
 * gone and the campaign vault workspace is rendered in its place (the
 * funding-intent runtime path was retired in #250). Asserts only this
 * route's own content — DEMO/TESTNET header chrome and cross-route
 * co-presence are covered by `trust-disclosures.integration.test.tsx`.
 */
describe("FundingPage", () => {
  it("renders the full testnet, non-custody and contract-custody disclosure texts verbatim", () => {
    render(<FundingPage />);

    expect(screen.getByText(disclosures.testnet.text)).toBeInTheDocument();
    expect(screen.getByText(disclosures["non-custody"].text)).toBeInTheDocument();
    expect(screen.getByText(disclosures["contract-custody"].text)).toBeInTheDocument();
  });

  it("renders the custody statement and its honest limits where the user meets custody and the refund path", () => {
    render(<FundingPage />);

    expect(
      screen.getByText(/los aportes los custodia el contrato, no una persona/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/no hay recuperación ni clawback/i)).toBeInTheDocument();
    expect(screen.getByText(/no se dispara solo/i)).toBeInTheDocument();
  });

  it("renders the test-asset-no-value and pre-sign-check microcopy", () => {
    render(<FundingPage />);

    expect(screen.getByText(microcopy.testAssetNoValue)).toBeInTheDocument();
    expect(screen.getByText(microcopy.preSignCheck)).toBeInTheDocument();
  });

  it("renders the campaign vault workspace, starting at the open-campaign panel while the journey has no campaign", () => {
    render(<FundingPage />);

    expect(screen.queryByText(/Step content coming soon/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pending replacement/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Abrir bóveda de campaña" })).toBeInTheDocument();
  });

  it("asks for the request first when the journey has no application", () => {
    rtlRender(
      <JourneyStoreProvider>
        <FundingPage />
      </JourneyStoreProvider>
    );

    expect(screen.getByRole("link", { name: "Ir a la solicitud" })).toHaveAttribute("href", "/request");
    expect(screen.queryByRole("heading", { level: 3, name: "Abrir bóveda de campaña" })).not.toBeInTheDocument();
  });

  it("resumes the campaign workspace (not the open panel) when the journey already has a campaign", () => {
    rtlRender(
      <JourneyStoreProvider initial={{ applicationId: APP, campaignId: CAMPAIGN }}>
        <FundingPage />
      </JourneyStoreProvider>
    );

    // No backend is configured in this test environment, so the campaign
    // never finishes loading; what matters here is which branch the page
    // enters — the campaign workspace region, not the open-campaign panel.
    expect(screen.getByRole("region", { name: "Bóveda de campaña" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "Abrir bóveda de campaña" })).not.toBeInTheDocument();
  });
});
