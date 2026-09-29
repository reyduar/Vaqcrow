import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ApplicationManualReviewContext } from "@vaqcrow/contracts";
import { ManualReviewContextPanel } from "./manual-review-context-panel";

const APPLICATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as ApplicationManualReviewContext["applicationId"];

function context(
  overrides: Partial<ApplicationManualReviewContext> = {}
): ApplicationManualReviewContext {
  return {
    applicationId: APPLICATION_ID,
    applicationState: "human_review",
    failureCode: "timeout",
    evidence: {
      periods: [
        {
          period: "2026-01",
          amountArs: 1_200_000,
          status: "reported",
          evidenceRef: "sales:2026-01",
          simuladoLabel: "SIMULADO"
        },
        {
          period: "2026-02",
          amountArs: null,
          status: "missing",
          evidenceRef: "missing:2026-02",
          simuladoLabel: "SIMULADO"
        }
      ],
      findings: [{ kind: "missing", period: "2026-02", evidenceRef: "missing:2026-02", messageKey: "review.finding.missing" }]
    },
    recordedAt: "2026-09-28T12:05:00.000Z",
    ...overrides
  };
}

describe("ManualReviewContextPanel", () => {
  it("renders the sanitized failure code as human copy, the application state and the stored timestamp", () => {
    render(<ManualReviewContextPanel context={context()} />);

    expect(screen.getByText(/no respondió a tiempo/i)).toBeInTheDocument();
    expect(screen.getByText("Revisión humana")).toBeInTheDocument();
    expect(screen.getByText("2026-09-28T12:05:00.000Z")).toBeInTheDocument();
  });

  it("keeps the simulated label visible when the provenance source is simulated", () => {
    render(
      <ManualReviewContextPanel
        context={context({
          providerProvenance: {
            model: "simulated-underwriter",
            promptVersion: "prompt-v1",
            generatedAt: "2026-09-28T12:05:00.000Z",
            source: "simulated"
          }
        })}
      />
    );

    expect(screen.getByText("SIMULADO")).toBeInTheDocument();
  });

  it("names the model and omits the simulated label for a provider-sourced record", () => {
    render(
      <ManualReviewContextPanel
        context={context({
          providerProvenance: {
            model: "live-underwriter",
            promptVersion: "prompt-v2",
            generatedAt: "2026-09-28T12:05:00.000Z",
            source: "provider"
          }
        })}
      />
    );

    expect(screen.getByText("live-underwriter")).toBeInTheDocument();
    expect(screen.queryByText("SIMULADO")).not.toBeInTheDocument();
  });

  it("says provenance is undeclared rather than inventing a source when none was stored", () => {
    render(<ManualReviewContextPanel context={context()} />);

    expect(screen.getByText(/sin procedencia declarada/i)).toBeInTheDocument();
    expect(screen.queryByText("SIMULADO")).not.toBeInTheDocument();
  });

  it("renders the validated evidence: periods (missing stays missing, never zero) and findings", () => {
    render(<ManualReviewContextPanel context={context()} />);

    expect(screen.getByText("sales:2026-01")).toBeInTheDocument();
    expect(screen.getByText("missing:2026-02")).toBeInTheDocument();
    expect(screen.getByText(/período faltante/i)).toBeInTheDocument();
  });

  it("offers no approval or recommendation control", () => {
    render(<ManualReviewContextPanel context={context()} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/recomendación/i)).not.toBeInTheDocument();
  });
});
