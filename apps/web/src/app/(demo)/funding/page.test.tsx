import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { disclosures, microcopy } from "@/application/trust/disclosures";
import FundingPage from "./page";

/**
 * Route-scoped disclosure assertions (Feature #17 / Task #54, spec obs #445)
 * plus the WU4 replacement check: the scaffold is gone and the real funding
 * workspace is rendered in its place. Asserts only this route's own content —
 * DEMO/TESTNET header chrome and cross-route co-presence are covered by
 * `trust-disclosures.integration.test.tsx`.
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

  it("renders the funding workspace instead of the scaffold placeholder", () => {
    render(<FundingPage />);

    expect(screen.queryByText(/Step content coming soon/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pending replacement/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Envío de fondeo" })).toBeInTheDocument();
  });
});
