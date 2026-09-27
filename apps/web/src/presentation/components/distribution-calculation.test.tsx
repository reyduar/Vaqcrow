import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { microcopy } from "@/application/trust/disclosures";
import { DistributionCalculation } from "./distribution-calculation";

const INPUTS = [
  { label: "Ventas declaradas · SIMULADO", value: "ARS 3.745.800,00" },
  { label: "Participación", value: "× 4,5 %" }
];

const TOTAL = { label: "Distribución calculada", value: "ARS 168.561,00" };

describe("DistributionCalculation", () => {
  it("renders the heading and rule as an accessible table caption", () => {
    render(
      <DistributionCalculation
        heading="Cálculo de distribución · agosto"
        ruleId="regla rs-v1.2"
        inputs={INPUTS}
        rounding="2 decimales, al par"
        total={TOTAL}
      />
    );

    const table = screen.getByRole("table", { name: /Cálculo de distribución · agosto/ });
    expect(table).toBeInTheDocument();
    expect(screen.getByText("regla rs-v1.2")).toBeInTheDocument();
  });

  it("renders every input row and the total exactly as provided, performing no arithmetic itself", () => {
    render(
      <DistributionCalculation
        heading="Cálculo de distribución · agosto"
        ruleId="regla rs-v1.2"
        inputs={INPUTS}
        rounding="2 decimales, al par"
        total={TOTAL}
      />
    );

    for (const row of INPUTS) {
      expect(screen.getByText(row.label)).toBeInTheDocument();
      expect(screen.getByText(row.value)).toBeInTheDocument();
    }
    expect(screen.getByText("2 decimales, al par")).toBeInTheDocument();
    expect(screen.getByText(TOTAL.label)).toBeInTheDocument();
    expect(screen.getByText(TOTAL.value)).toBeInTheDocument();
  });

  it("renders the canonical deterministic-calculation microcopy verbatim, adjacent to the table", () => {
    render(
      <DistributionCalculation
        heading="Cálculo de distribución · agosto"
        ruleId="regla rs-v1.2"
        inputs={INPUTS}
        rounding="2 decimales, al par"
        total={TOTAL}
      />
    );

    expect(screen.getByText(microcopy.deterministicCalculation)).toBeInTheDocument();
  });

  it("renders no AI badge or styling hook", () => {
    const { container } = render(
      <DistributionCalculation
        heading="Cálculo de distribución · agosto"
        ruleId="regla rs-v1.2"
        inputs={INPUTS}
        rounding="2 decimales, al par"
        total={TOTAL}
      />
    );

    expect(container.querySelector('[data-variant="risk"]')).not.toBeInTheDocument();
    expect(screen.queryByText(/evaluación de ia/i)).not.toBeInTheDocument();
  });
});
