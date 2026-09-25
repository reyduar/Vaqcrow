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

import FundingPage from "./page";

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

  it("renders the test-asset-no-value and pre-sign-check microcopy", () => {
    render(<FundingPage />);

    expect(screen.getByText(microcopy.testAssetNoValue)).toBeInTheDocument();
    expect(screen.getByText(microcopy.preSignCheck)).toBeInTheDocument();
  });

  it("renders the campaign vault workspace, starting at the open-campaign panel with no ?campaign= in the URL", () => {
    render(<FundingPage />);

    expect(screen.queryByText(/Step content coming soon/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pending replacement/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Abrir bóveda de campaña" })).toBeInTheDocument();
  });

  it("resumes the campaign workspace (not the open panel) when ?campaign= is already in the URL", () => {
    get.mockReturnValueOnce("11111111-1111-4111-8111-111111111111");

    render(<FundingPage />);

    // No backend is configured in this test environment, so the campaign
    // never finishes loading; what matters here is which branch the page
    // enters — the campaign workspace region, not the open-campaign panel.
    expect(screen.getByRole("region", { name: "Bóveda de campaña" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "Abrir bóveda de campaña" })).not.toBeInTheDocument();
  });
});
