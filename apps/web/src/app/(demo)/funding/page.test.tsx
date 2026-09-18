import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { disclosures, microcopy } from "@/application/trust/disclosures";
import FundingPage from "./page";

/**
 * Route-scoped disclosure assertions (Feature #17 / Task #54, spec obs #445).
 * Asserts only this route's own content — DEMO/TESTNET header chrome and
 * cross-route co-presence are covered by `trust-disclosures.integration.test.tsx`.
 */
describe("FundingPage", () => {
  it("renders the full testnet and non-custody disclosure texts verbatim", () => {
    render(<FundingPage />);

    expect(screen.getByText(disclosures.testnet.text)).toBeInTheDocument();
    expect(screen.getByText(disclosures["non-custody"].text)).toBeInTheDocument();
  });

  it("renders the test-asset-no-value and pre-sign-check microcopy", () => {
    render(<FundingPage />);

    expect(screen.getByText(microcopy.testAssetNoValue)).toBeInTheDocument();
    expect(screen.getByText(microcopy.preSignCheck)).toBeInTheDocument();
  });

  it("renders the relocated WorkspaceStatus probe labeled as a scaffold", () => {
    render(<FundingPage />);

    expect(screen.getByRole("heading", { level: 2, name: "Vaqcrow Workspace" })).toBeInTheDocument();
    expect(screen.getByText(/scaffold/i)).toBeInTheDocument();
  });
});
