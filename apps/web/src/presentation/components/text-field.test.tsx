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

  it("marks the field invalid and shows a visible error next to the helper text, both linked via aria-describedby", () => {
    render(
      <TextField
        label="Período desde"
        helperText="Formato AAAA-MM."
        error="Usá el formato AAAA-MM, por ejemplo 2026-01."
      />
    );

    const input = screen.getByLabelText("Período desde");

    expect(input).toHaveAttribute("aria-invalid", "true");
    // The helper carries the format instructions, which are needed most while
    // the field is in error, so it stays visible and described.
    expect(input).toHaveAccessibleDescription(
      expect.stringContaining("Usá el formato AAAA-MM, por ejemplo 2026-01.")
    );
    expect(input).toHaveAccessibleDescription(expect.stringContaining("Formato AAAA-MM."));
    expect(screen.getByText("Formato AAAA-MM.")).toBeVisible();
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

  it("marks the visible error region as an alert for assistive tech (T3: needed by SmeRequestForm's migrated fields)", () => {
    render(<TextField label="Período desde" error="Campo obligatorio." />);

    expect(screen.getByRole("alert")).toHaveTextContent("Campo obligatorio.");
  });

  it("renders a native date input when type is date (T3: CampaignWorkspace's deadline field)", () => {
    const onChange = vi.fn();
    render(<TextField label="Fecha límite" type="date" value="" onChange={onChange} />);

    const input = screen.getByLabelText("Fecha límite");
    expect(input).toHaveAttribute("type", "date");

    fireEvent.change(input, { target: { value: "2026-12-01" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-12-01");
  });
});
