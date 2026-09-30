import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PreparedRevenueShareDistribution } from "@vaqcrow/contracts";
import { DistributionDerivation } from "./distribution-derivation";

const derivation: PreparedRevenueShareDistribution["derivation"] = {
  ruleVersion: "RS-2026-01",
  rateBps: 450,
  period: "2026-08",
  salesArs: "3745800",
  obligationArs: "168561",
  excludedPeriods: [
    { period: "2026-07", status: "missing", reason: "missing_data" },
    { period: "2026-06", status: "anomalous", reason: "requires_review" }
  ],
  conversion: { goalStroops: "1000000000", approvedLimitArs: "5000000", totalStroops: "33712200" },
  simulated: true
};

const recipients = [
  { accountId: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", amountStroops: 20_227_320n },
  { accountId: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", amountStroops: 13_484_880n }
];

describe("DistributionDerivation", () => {
  it("shows the period, the reported sales, the rate and the obligation, labeled simulated", () => {
    render(<DistributionDerivation derivation={derivation} recipients={recipients} />);

    const region = screen.getByRole("region", { name: "Cálculo de la distribución" });
    expect(within(region).getAllByText("SIMULADO").length).toBeGreaterThan(0);
    expect(within(region).getByText("2026-08")).toBeInTheDocument();
    expect(within(region).getByText("ARS 3.745.800")).toBeInTheDocument();
    expect(within(region).getByText("4,50 %")).toBeInTheDocument();
    expect(within(region).getByText("ARS 168.561")).toBeInTheDocument();
    expect(within(region).getByText("RS-2026-01")).toBeInTheDocument();
  });

  it("names every excluded period and why it was left out", () => {
    render(<DistributionDerivation derivation={derivation} recipients={recipients} />);

    expect(screen.getByText(/2026-07/)).toHaveTextContent("faltan datos");
    expect(screen.getByText(/2026-06/)).toHaveTextContent("requiere revisión");
  });

  it("says no period was excluded when none was", () => {
    render(<DistributionDerivation derivation={{ ...derivation, excludedPeriods: [] }} recipients={recipients} />);

    expect(screen.getByText("Ningún período quedó excluido.")).toBeInTheDocument();
  });

  it("explains the conversion basis: the campaign goal in XLM against the approved limit in ARS, and the resulting total", () => {
    render(<DistributionDerivation derivation={derivation} recipients={recipients} />);

    expect(screen.getByText("100 XLM")).toBeInTheDocument();
    expect(screen.getByText("ARS 5.000.000")).toBeInTheDocument();
    expect(screen.getByText("3.37122 XLM")).toBeInTheDocument();
    expect(screen.getByText(/no es una cotización de mercado/i)).toBeInTheDocument();
  });

  it("lists each recipient with the amount in XLM", () => {
    render(<DistributionDerivation derivation={derivation} recipients={recipients} />);

    const list = screen.getByRole("list", { name: "Destinatarios" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("2.022732 XLM");
    expect(items[0]).toHaveTextContent(recipients[0]!.accountId);
    expect(items[1]).toHaveTextContent("1.348488 XLM");
  });
});
