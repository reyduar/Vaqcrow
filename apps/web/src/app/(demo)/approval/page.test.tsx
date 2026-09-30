import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { microcopy } from "@/application/trust/disclosures";
import { JourneyStoreProvider } from "@/state/journey-store-provider";
import ApprovalPage from "./page";

const APP = "5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f";
const withApplication = ({ children }: { children: ReactNode }) => (
  <JourneyStoreProvider initial={{ applicationId: APP }}>{children}</JourneyStoreProvider>
);

/**
 * Route-scoped disclosure assertions (Feature #17 / Task #54, spec obs #445).
 * Asserts only this route's own content — DEMO/TESTNET header chrome and
 * cross-route co-presence are covered by `trust-disclosures.integration.test.tsx`.
 */
describe("ApprovalPage", () => {
  it("renders the human-decision microcopy", () => {
    render(<ApprovalPage />, { wrapper: JourneyStoreProvider });

    expect(screen.getByText(microcopy.humanDecision)).toBeInTheDocument();
  });

  it("renders the AI disclosure banner and the human-decision note as visually separate elements", () => {
    render(<ApprovalPage />, { wrapper: JourneyStoreProvider });

    const banner = screen.getByRole("note");
    const decisionNote = screen.getByText(microcopy.humanDecision);

    expect(banner).toBeInTheDocument();
    expect(decisionNote).toBeInTheDocument();
    expect(banner).not.toBe(decisionNote);
    expect(banner.contains(decisionNote)).toBe(false);
  });

  it("renders the human decision form apart from the AI assessment notice", () => {
    render(<ApprovalPage />, { wrapper: withApplication });

    expect(screen.getByRole("form", { name: /Decisión humana/ })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Sin evaluación de IA registrada/ })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("asks for the request first when the journey has no application", () => {
    render(<ApprovalPage />, { wrapper: JourneyStoreProvider });

    expect(screen.getByRole("link", { name: "Ir a la solicitud" })).toHaveAttribute("href", "/request");
    expect(screen.queryByRole("form", { name: /Decisión humana/ })).not.toBeInTheDocument();
  });
});
