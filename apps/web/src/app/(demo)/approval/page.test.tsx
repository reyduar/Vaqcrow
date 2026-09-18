import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { microcopy } from "@/application/trust/disclosures";
import ApprovalPage from "./page";

/**
 * Route-scoped disclosure assertions (Feature #17 / Task #54, spec obs #445).
 * Asserts only this route's own content — DEMO/TESTNET header chrome and
 * cross-route co-presence are covered by `trust-disclosures.integration.test.tsx`.
 */
describe("ApprovalPage", () => {
  it("renders the human-decision microcopy", () => {
    render(<ApprovalPage />);

    expect(screen.getByText(microcopy.humanDecision)).toBeInTheDocument();
  });

  it("renders the AI disclosure banner and the human-decision note as visually separate elements", () => {
    render(<ApprovalPage />);

    const banner = screen.getByRole("note");
    const decisionNote = screen.getByText(microcopy.humanDecision);

    expect(banner).toBeInTheDocument();
    expect(decisionNote).toBeInTheDocument();
    expect(banner).not.toBe(decisionNote);
    expect(banner.contains(decisionNote)).toBe(false);
  });
});
