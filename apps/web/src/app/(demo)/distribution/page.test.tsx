import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { disclosures, microcopy } from "@/application/trust/disclosures";
import DistributionPage from "./page";

/**
 * Route-scoped disclosure assertions (Feature #17 / Task #54, spec obs #445).
 * Asserts only this route's own content — DEMO/TESTNET header chrome and
 * cross-route co-presence are covered by `trust-disclosures.integration.test.tsx`.
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
});
