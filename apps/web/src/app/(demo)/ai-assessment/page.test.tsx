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

  it("renders the fallback banner microcopy when a backup AI response applies", () => {
    render(<AiAssessmentPage />);

    expect(screen.getByText(microcopy.aiFallback)).toBeInTheDocument();
  });

  it("renders the simulated, advisory-only assessment with cited evidence", () => {
    render(<AiAssessmentPage />);

    expect(screen.getByRole("region", { name: /Evaluación de IA \(simulada\)/ })).toBeInTheDocument();
    expect(screen.getByText("Riesgo medio")).toBeInTheDocument();
    expect(screen.getByText("missing:2026-04")).toBeInTheDocument();
  });

  it("offers no decision control: the decision lives on the approval step", () => {
    render(<AiAssessmentPage />);

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Registrar decisión/ })).not.toBeInTheDocument();
  });
});
