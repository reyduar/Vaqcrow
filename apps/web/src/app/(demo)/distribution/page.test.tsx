import { render as rtlRender, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { disclosures, microcopy } from "@/application/trust/disclosures";
import type { JourneyIds } from "@/state/journey-store";
import { JourneyStoreProvider } from "@/state/journey-store-provider";
import DistributionPage from "./page";

const APP = "5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f";
const CAMPAIGN = "40000000-0000-4000-8000-000000000000";
const DISTRIBUTION = "123e4567-e89b-42d3-a456-4266141740ab";

const render = (
  ui: ReactElement,
  initial: Partial<JourneyIds> = { applicationId: APP, campaignId: CAMPAIGN }
) =>
  rtlRender(<JourneyStoreProvider initial={initial}>{ui}</JourneyStoreProvider>);

/**
 * Route-scoped disclosure assertions (Feature #17 / Task #54, spec obs #445)
 * plus the journey wiring: the page shows the distribution the journey holds
 * and asks for the request first when there is no application — beside, never
 * instead of, its disclosures.
 */
describe("DistributionPage", () => {
  it("renders the full testnet disclosure text verbatim", () => {
    render(<DistributionPage />);

    expect(screen.getByText(disclosures.testnet.text)).toBeInTheDocument();
  });

  it("renders the submitted-not-confirmed microcopy", () => {
    render(<DistributionPage />);

    expect(screen.getByText(microcopy.submittedNotConfirmed)).toBeInTheDocument();
  });

  it("shows the journey's distribution id without losing its disclosure content", () => {
    render(<DistributionPage />, {
      applicationId: APP,
      campaignId: CAMPAIGN,
      distributionId: DISTRIBUTION
    });

    expect(screen.getByText(DISTRIBUTION)).toBeInTheDocument();
    expect(screen.getByText(disclosures.testnet.text)).toBeInTheDocument();
    expect(screen.getByText(microcopy.submittedNotConfirmed)).toBeInTheDocument();
  });

  it("asks for the request first when the journey has no application, keeping the disclosures", () => {
    rtlRender(
      <JourneyStoreProvider>
        <DistributionPage />
      </JourneyStoreProvider>
    );

    expect(screen.getByRole("link", { name: "Ir a la solicitud" })).toHaveAttribute("href", "/request");
    expect(screen.getByText(disclosures.testnet.text)).toBeInTheDocument();
  });
});
