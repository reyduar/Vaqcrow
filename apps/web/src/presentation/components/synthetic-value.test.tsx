import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SyntheticValue } from "./synthetic-value";

describe("SyntheticValue", () => {
  it("renders the value and an adjacent SIMULADO badge together", () => {
    render(<SyntheticValue value="Panadería Horizonte SRL" simuladoLabel="SIMULADO" />);

    expect(screen.getByText("Panadería Horizonte SRL")).toBeInTheDocument();
    expect(screen.getByText("SIMULADO")).toBeInTheDocument();
  });

  it.each([{ simuladoLabel: "SIMULADO" }, { simuladoLabel: "DATO DE PRUEBA" }])(
    "sources the badge's accessible text from simuladoLabel ($simuladoLabel), not a hardcoded string",
    ({ simuladoLabel }) => {
      render(<SyntheticValue value="$3.150.000" simuladoLabel={simuladoLabel} />);

      const badge = screen.getByText(simuladoLabel);

      expect(badge).toHaveAttribute("data-variant", "simulado");
    }
  );

  it("renders the optional label when provided", () => {
    render(<SyntheticValue label="Empresa" value="Panadería Horizonte SRL" simuladoLabel="SIMULADO" />);

    expect(screen.getByText("Empresa:")).toBeInTheDocument();
  });

  it("omits the label when not provided", () => {
    render(<SyntheticValue value="Panadería Horizonte SRL" simuladoLabel="SIMULADO" />);

    expect(screen.queryByText("Empresa:")).not.toBeInTheDocument();
  });
});
