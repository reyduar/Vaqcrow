import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChipToggleGroup, type ChipToggleGroupOption } from "./chip-toggle-group";

const SECTORS: readonly ChipToggleGroupOption[] = [
  { value: "alimentos", label: "Alimentos" },
  { value: "servicios", label: "Servicios" },
  { value: "comercio", label: "Comercio minorista" }
];

describe("ChipToggleGroup", () => {
  it("renders the group label and every option as a pressable, unselected chip", () => {
    render(<ChipToggleGroup label="Sector" options={SECTORS} />);

    expect(screen.getByText("Sector")).toBeInTheDocument();
    for (const option of SECTORS) {
      expect(screen.getByRole("button", { name: option.label })).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("toggles a chip to pressed and reports the updated selection on click", () => {
    const onChange = vi.fn();
    render(<ChipToggleGroup label="Sector" options={SECTORS} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Alimentos" }));

    expect(screen.getByRole("button", { name: "Alimentos" })).toHaveAttribute("aria-pressed", "true");
    expect(onChange).toHaveBeenLastCalledWith(["alimentos"]);
  });

  it("supports selecting more than one chip at a time", () => {
    const onChange = vi.fn();
    render(<ChipToggleGroup label="Sector" options={SECTORS} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Alimentos" }));
    fireEvent.click(screen.getByRole("button", { name: "Servicios" }));

    expect(onChange).toHaveBeenLastCalledWith(expect.arrayContaining(["alimentos", "servicios"]));
  });

  it("marks the selected state with visible text beyond aria-pressed, not colour alone", () => {
    render(<ChipToggleGroup label="Sector" options={SECTORS} defaultValue={["comercio"]} />);

    const selected = screen.getByRole("button", { name: /Comercio minorista/ });
    const unselected = screen.getByRole("button", { name: "Alimentos" });

    expect(selected.querySelector("[aria-hidden='true']")).not.toBeNull();
    expect(unselected.querySelector("[aria-hidden='true']")).toBeNull();
  });

  it("is keyboard operable", () => {
    const onChange = vi.fn();
    render(<ChipToggleGroup label="Sector" options={SECTORS} onChange={onChange} />);

    const chip = screen.getByRole("button", { name: "Alimentos" });
    chip.focus();
    fireEvent.keyDown(chip, { key: " " });
    fireEvent.keyUp(chip, { key: " " });

    expect(onChange).toHaveBeenLastCalledWith(["alimentos"]);
  });
});
