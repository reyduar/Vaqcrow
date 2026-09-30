import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { disclosures, microcopy } from "@/application/trust/disclosures";
import { JourneyStoreProvider } from "@/state/journey-store-provider";
import AiAssessmentPage from "./page";

const renderPage = (applicationId: string | null = null) =>
  render(<AiAssessmentPage />, {
    wrapper: ({ children }) => (
      <JourneyStoreProvider initial={{ applicationId }}>{children}</JourneyStoreProvider>
    )
  });

/**
 * Route-scoped disclosure assertions (Feature #17 / Task #54, spec obs #445).
 * Asserts only this route's own content — DEMO/TESTNET header chrome and
 * cross-route co-presence are covered by `trust-disclosures.integration.test.tsx`.
 */
describe("AiAssessmentPage", () => {
  it("renders the full human-ai disclosure text verbatim", () => {
    renderPage();

    expect(screen.getByText(disclosures["human-ai"].text)).toBeInTheDocument();
  });

  it("renders the human-decision microcopy", () => {
    renderPage();

    expect(screen.getByText(microcopy.humanDecision)).toBeInTheDocument();
  });

  it("renders the fallback disclosure as standing policy, not as a claimed outcome", () => {
    renderPage();

    // Feature #17 requires this route to state what happens when the AI is
    // unavailable. That policy holds whether or not a failure is happening.
    expect(screen.getByText(microcopy.aiFallback)).toBeInTheDocument();
  });

  it("asks for the request first when the journey has no application, and claims no result", () => {
    renderPage();

    expect(screen.getByRole("link", { name: /ir a la solicitud/i })).toHaveAttribute("href", "/request");
    expect(screen.queryByRole("button", { name: /consultar evaluación de IA/i })).not.toBeInTheDocument();
    // The frozen fixture used to render here unconditionally. A canned
    // assessment that looks like a result is exactly what this route must not
    // show before a real one exists.
    expect(screen.queryByRole("region", { name: /Evaluación de IA/ })).not.toBeInTheDocument();
  });

  it("offers the real assessment and claims no result before it is asked for", () => {
    renderPage("3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10");

    expect(screen.getByRole("button", { name: /consultar evaluación de IA/i })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Evaluación de IA/ })).not.toBeInTheDocument();
    expect(screen.getByText(/todavía no se consultó/i)).toBeInTheDocument();
  });

  it("offers no decision control: the decision lives on the approval step", () => {
    renderPage();

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Registrar decisión/ })).not.toBeInTheDocument();
  });
});
