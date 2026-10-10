import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PortfolioDistribution } from "@/application/ports/portfolio-port";
import { microcopy } from "@/application/trust/disclosures";
import { PortfolioDistributions } from "./portfolio-distributions";

function distribution(overrides: Partial<PortfolioDistribution> = {}): PortfolioDistribution {
  return {
    distributionId: "11111111-1111-4111-8111-111111111111",
    campaignId: "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10",
    campaignName: "Café Tostadero del Paraná",
    period: "2026-08",
    amountXlm: "4.1200000",
    status: "confirmed",
    transactionHash: "a".repeat(64),
    explorerUrl: null,
    ...overrides
  };
}

describe("PortfolioDistributions", () => {
  it("shows each distribution's hash with its explorer link and the canonical hash note once (#438/WU5)", () => {
    render(
      <PortfolioDistributions
        distributions={[
          distribution({ explorerUrl: "https://explorer.example/tx/a" }),
          distribution({ distributionId: "22222222-2222-4222-8222-222222222222", transactionHash: "b".repeat(64) })
        ]}
      />
    );

    const link = screen.getByRole("link", {
      name: `Ver en el explorador: hash ${"a".repeat(64)} (abre en una pestaña nueva)`
    });
    expect(link).toHaveAttribute("href", "https://explorer.example/tx/a");
    expect(screen.getByTitle("b".repeat(64))).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getAllByText(microcopy.hashTechnicalOnly)).toHaveLength(1);
  });

  it("renders the heading, the SIMULADO badge and the footer note", () => {
    render(<PortfolioDistributions distributions={[distribution()]} />);

    expect(screen.getByRole("heading", { name: "Distribuciones" })).toBeInTheDocument();
    expect(screen.getByText("SIMULADO")).toBeInTheDocument();
    expect(screen.getByText("Cálculo determinístico; la IA no calcula esta obligación.")).toBeInTheDocument();
  });

  it("renders a confirmed row with amount, joined detail and state label", () => {
    render(<PortfolioDistributions distributions={[distribution()]} />);

    expect(screen.getByText("4,1200000 XLM")).toBeInTheDocument();
    expect(screen.getByText("Café Tostadero del Paraná · 2026-08")).toBeInTheDocument();
    expect(screen.getByText("Confirmada")).toBeInTheDocument();
  });

  it("renders the submitted state with the template's copy", () => {
    render(<PortfolioDistributions distributions={[distribution({ status: "submitted" })]} />);
    expect(screen.getByText("Calculada · falta firma de la PyME")).toBeInTheDocument();
  });

  it("renders the failed state label", () => {
    render(<PortfolioDistributions distributions={[distribution({ status: "failed" })]} />);
    expect(screen.getByText("Fallida")).toBeInTheDocument();
  });

  it("never invents a separator when campaign and period are absent", () => {
    render(<PortfolioDistributions distributions={[distribution({ campaignName: null, period: null })]} />);

    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
    expect(screen.getByText("4,1200000 XLM")).toBeInTheDocument();
  });

  it("renders only the period when the campaign name is absent", () => {
    render(<PortfolioDistributions distributions={[distribution({ campaignName: null, period: "2026-08" })]} />);

    expect(screen.getByText("2026-08")).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });
});
