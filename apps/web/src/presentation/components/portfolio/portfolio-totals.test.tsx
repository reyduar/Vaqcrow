import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PortfolioTotals as PortfolioTotalsData } from "@/application/ports/portfolio-port";
import { PortfolioTotals } from "./portfolio-totals";

function totals(overrides: Partial<PortfolioTotalsData> = {}): PortfolioTotalsData {
  return { totalContributedXlm: "250.0000000", totalDistributionsXlm: "4.1200000", campaignCount: 3, ...overrides };
}

describe("PortfolioTotals", () => {
  it("renders Total aportado with the campaign count note", () => {
    render(<PortfolioTotals totals={totals()} />);

    expect(screen.getByText("Total aportado")).toBeInTheDocument();
    expect(screen.getByText("250,0000000 XLM")).toBeInTheDocument();
    expect(screen.getByText("En 3 campañas")).toBeInTheDocument();
  });

  it("uses the singular campana note for one campaign", () => {
    render(<PortfolioTotals totals={totals({ campaignCount: 1 })} />);
    expect(screen.getByText("En 1 campaña")).toBeInTheDocument();
  });

  it("renders distributions and their note", () => {
    render(<PortfolioTotals totals={totals()} />);

    expect(screen.getByText("Distribuciones recibidas")).toBeInTheDocument();
    expect(screen.getByText("4,1200000 XLM")).toBeInTheDocument();
    expect(screen.getByText("Calculadas para períodos simulados")).toBeInTheDocument();
  });

  it("renders Sin dato, never a fabricated zero, when distributions are null", () => {
    render(<PortfolioTotals totals={totals({ totalDistributionsXlm: null })} />);

    expect(screen.getByText("Sin dato")).toBeInTheDocument();
    expect(screen.queryByText("0,0000000 XLM")).not.toBeInTheDocument();
  });
});
