import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComboBox } from "./combo-box";

const CITIES: readonly string[] = ["Córdoba", "Mendoza", "Rosario", "La Matanza", "Mar del Plata"];

describe("ComboBox", () => {
  it("renders a labelled text input for filtering", () => {
    render(<ComboBox label="Ciudad" items={CITIES} />);

    expect(screen.getByRole("combobox", { name: "Ciudad" })).toBeInTheDocument();
  });

  it("filters the option list as the user types and reports the selected value", () => {
    const onChange = vi.fn();
    render(<ComboBox label="Ciudad" items={CITIES} onChange={onChange} />);

    const input = screen.getByRole("combobox", { name: "Ciudad" });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.change(input, { target: { value: "Mar" } });

    expect(screen.getByRole("option", { name: "Mar del Plata" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Córdoba" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: "Mar del Plata" }));

    expect(onChange).toHaveBeenLastCalledWith("Mar del Plata");
  });

  it("shows a visible empty-results message when nothing matches", () => {
    render(<ComboBox label="Ciudad" items={CITIES} emptyResultsText="No se encontraron ciudades." />);

    const input = screen.getByRole("combobox", { name: "Ciudad" });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.change(input, { target: { value: "Ushuaia" } });

    expect(screen.getByText("No se encontraron ciudades.")).toBeInTheDocument();
  });

  it("shows a visible error next to the helper text", () => {
    render(
      <ComboBox label="Ciudad" items={CITIES} helperText="Escribí para filtrar." error="Elegí una ciudad." />
    );

    expect(screen.getByText("Elegí una ciudad.")).toBeInTheDocument();
    expect(screen.getByText("Escribí para filtrar.")).toBeVisible();
  });
});
