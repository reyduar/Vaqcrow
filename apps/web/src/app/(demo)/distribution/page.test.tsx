import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { disclosures, microcopy } from "@/application/trust/disclosures";

const { replace, get } = vi.hoisted(() => ({
  replace: vi.fn(),
  get: vi.fn().mockReturnValue(null)
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => ({ get, toString: () => "" })
}));

import DistributionPage from "./page";

/**
 * Route-scoped disclosure assertions (Feature #17 / Task #54, spec obs #445)
 * plus the T92-03 URL-identity check: the page reads `?distribution=` and
 * shows the id it read, beside — never instead of — its disclosures.
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

  it("shows the distribution id it read from ?distribution= without losing its disclosure content", () => {
    const distributionId = "123e4567-e89b-42d3-a456-4266141740ab";
    get.mockReturnValueOnce(distributionId);

    render(<DistributionPage />);

    expect(screen.getByText(distributionId)).toBeInTheDocument();
    expect(screen.getByText(disclosures.testnet.text)).toBeInTheDocument();
    expect(screen.getByText(microcopy.submittedNotConfirmed)).toBeInTheDocument();
  });
});
