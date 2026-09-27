import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TextField } from "./text-field";

describe("TextField", () => {
  it("renders a labelled input and reports typed changes", () => {
    const onChange = vi.fn();
    render(<TextField label="Total declarado (ARS)" value="" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Total declarado (ARS)"), { target: { value: "100" } });

    expect(onChange).toHaveBeenLastCalledWith("100");
  });

  it("shows helper text when there is no error", () => {
    render(<TextField label="Período desde" helperText="Formato AAAA-MM." />);

    expect(screen.getByText("Formato AAAA-MM.")).toBeInTheDocument();
  });

  it("marks the field invalid and shows a visible error linked via aria-describedby, hiding the helper text", () => {
    render(
      <TextField
        label="Período desde"
        helperText="Formato AAAA-MM."
        error="Usá el formato AAAA-MM, por ejemplo 2026-01."
      />
    );

    const input = screen.getByLabelText("Período desde");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Usá el formato AAAA-MM, por ejemplo 2026-01.");
    expect(screen.queryByText("Formato AAAA-MM.")).not.toBeInTheDocument();
  });

  it("renders a visible, announced unit suffix next to the value", () => {
    render(<TextField label="Monto a aportar" value="250" unit="XLM" />);

    const input = screen.getByLabelText("Monto a aportar");

    expect(screen.getByText("XLM")).toBeInTheDocument();
    expect(input).toHaveAccessibleDescription(/XLM/);
  });

  it("shows the SIMULADO tag contiguous to a read-only value", () => {
    render(
      <TextField label="Razón social" value="Panadería Horizonte SRL" isReadOnly simuladoLabel="SIMULADO" />
    );

    const input = screen.getByLabelText("Razón social");

    expect(input).toHaveValue("Panadería Horizonte SRL");
    expect(input).toHaveAttribute("readonly");
    expect(screen.getByText("SIMULADO")).toBeInTheDocument();
  });
});
