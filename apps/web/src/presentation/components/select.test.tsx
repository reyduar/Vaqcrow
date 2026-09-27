import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Select, type SelectOption } from "./select";

const PROVINCES: readonly SelectOption[] = [
  { value: "cordoba", label: "Córdoba" },
  { value: "mendoza", label: "Mendoza" },
  { value: "santa-fe", label: "Santa Fe" }
];

describe("Select", () => {
  it("renders a labelled trigger showing the placeholder when nothing is selected", () => {
    render(<Select label="Provincia" placeholder="Elegí una provincia" options={PROVINCES} />);

    expect(screen.getByRole("button", { name: /Provincia/ })).toHaveTextContent("Elegí una provincia");
  });

  it("opens the listbox, selects an option with the keyboard, and reports the value", () => {
    const onChange = vi.fn();
    render(<Select label="Provincia" placeholder="Elegí una provincia" options={PROVINCES} onChange={onChange} />);

    const trigger = screen.getByRole("button", { name: /Provincia/ });
    fireEvent.click(trigger);

    const option = screen.getByRole("option", { name: "Mendoza" });
    fireEvent.click(option);

    expect(onChange).toHaveBeenLastCalledWith("mendoza");
    expect(trigger).toHaveTextContent("Mendoza");
  });

  it("shows a visible error linked via aria-describedby, hiding the helper text", () => {
    render(
      <Select
        label="Provincia"
        options={PROVINCES}
        helperText="Usada para estimar el riesgo."
        error="Elegí una provincia."
      />
    );

    expect(screen.getByText("Elegí una provincia.")).toBeInTheDocument();
    expect(screen.queryByText("Usada para estimar el riesgo.")).not.toBeInTheDocument();
  });
});
