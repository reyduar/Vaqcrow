import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SalesEvidenceTable } from "./sales-evidence-table";

describe("SalesEvidenceTable", () => {
  it("renders as an accessible table with the required column headers", () => {
    render(<SalesEvidenceTable />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    for (const header of ["Período", "Ventas", "Procedencia", "Estado"]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
  });

  it("renders all 8 monthly rows", () => {
    render(<SalesEvidenceTable />);

    expect(screen.getAllByRole("row")).toHaveLength(9); // 1 header row + 8 data rows
  });

  it("renders April as explicitly missing — never blank, never zero", () => {
    render(<SalesEvidenceTable />);

    const aprilRow = screen.getByRole("row", { name: /Abril 2026/ });

    expect(within(aprilRow).getByText("Dato faltante")).toBeInTheDocument();
    expect(within(aprilRow).queryByText(/\$\s?0\b/)).not.toBeInTheDocument();
    expect(within(aprilRow).queryByText("0")).not.toBeInTheDocument();
  });

  it("renders June with its SIMULADO badge, its anomaly status, and no causal claim", () => {
    render(<SalesEvidenceTable />);

    const juneRow = screen.getByRole("row", { name: /Junio 2026/ });

    expect(within(juneRow).getByText("SIMULADO")).toBeInTheDocument();
    expect(within(juneRow).getByText("Requiere revisión")).toBeInTheDocument();
    expect(juneRow.textContent?.toLowerCase()).not.toMatch(
      /porque|debido a|causad[ao] por|a raíz de|se debe a/
    );
  });
});
