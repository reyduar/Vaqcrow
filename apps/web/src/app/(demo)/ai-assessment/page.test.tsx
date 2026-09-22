import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { disclosures, microcopy } from "@/application/trust/disclosures";
import AiAssessmentPage from "./page";

/**
 * Route-scoped disclosure assertions (Feature #17 / Task #54, spec obs #445).
 * Asserts only this route's own content — DEMO/TESTNET header chrome and
 * cross-route co-presence are covered by `trust-disclosures.integration.test.tsx`.
 */
describe("AiAssessmentPage", () => {
  it("renders the full human-ai disclosure text verbatim", () => {
    render(<AiAssessmentPage />);

    expect(screen.getByText(disclosures["human-ai"].text)).toBeInTheDocument();
  });

  it("renders the human-decision microcopy", () => {
    render(<AiAssessmentPage />);

    expect(screen.getByText(microcopy.humanDecision)).toBeInTheDocument();
  });

  it("renders the fallback disclosure as standing policy, not as a claimed outcome", () => {
    render(<AiAssessmentPage />);

    // Feature #17 requires this route to state what happens when the AI is
    // unavailable. That policy holds whether or not a failure is happening.
    expect(screen.getByText(microcopy.aiFallback)).toBeInTheDocument();
  });

  it("offers the real assessment and claims no result before it is asked for", () => {
    render(<AiAssessmentPage />);

    expect(screen.getByRole("button", { name: /consultar evaluación de IA/i })).toBeInTheDocument();
    // The frozen fixture used to render here unconditionally. A canned
    // assessment that looks like a result is exactly what this route must not
    // show before a real one exists.
    expect(screen.queryByRole("region", { name: /Evaluación de IA/ })).not.toBeInTheDocument();
    expect(screen.getByText(/todavía no se consultó/i)).toBeInTheDocument();
  });

  it("offers no decision control: the decision lives on the approval step", () => {
    render(<AiAssessmentPage />);

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Registrar decisión/ })).not.toBeInTheDocument();
  });
});
