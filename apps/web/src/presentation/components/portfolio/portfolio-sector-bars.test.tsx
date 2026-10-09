import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PortfolioSectorBars } from "./portfolio-sector-bars";

describe("PortfolioSectorBars", () => {
  it("renders the sector heading and one row per sector with its percent", () => {
    render(
      <PortfolioSectorBars
        rows={[
          { sector: "Gastronomía", percent: 47 },
          { sector: "Alimentos", percent: 29 }
        ]}
      />
    );

    expect(screen.getByRole("heading", { name: "Aportes por sector" })).toBeInTheDocument();
    expect(screen.getByText("Gastronomía")).toBeInTheDocument();
    expect(screen.getByText("47 %")).toBeInTheDocument();
    expect(screen.getByText("29 %")).toBeInTheDocument();
  });

  it("renders the heading with no rows when there is nothing to show", () => {
    render(<PortfolioSectorBars rows={[]} />);

    expect(screen.getByRole("heading", { name: "Aportes por sector" })).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
