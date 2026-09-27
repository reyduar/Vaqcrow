import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TextArea } from "./text-area";

describe("TextArea", () => {
  it("renders a labelled textarea and reports typed changes", () => {
    const onChange = vi.fn();
    render(<TextArea label="Razón de la decisión" value="" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Razón de la decisión"), { target: { value: "Aprobado" } });

    expect(onChange).toHaveBeenLastCalledWith("Aprobado");
  });

  it("shows helper text when there is no error", () => {
    render(<TextArea label="Comentario" helperText="Opcional." />);

    expect(screen.getByText("Opcional.")).toBeInTheDocument();
  });

  it("marks a required field invalid with a visible error linked via aria-describedby", () => {
    render(<TextArea label="Razón de la decisión" isRequired error="Campo obligatorio." />);

    const textarea = screen.getByLabelText("Razón de la decisión");

    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(textarea).toBeRequired();
    expect(textarea).toHaveAccessibleDescription("Campo obligatorio.");
    expect(screen.getByText("Campo obligatorio.")).toBeInTheDocument();
  });

  it("keeps the helper text visible and described while the field is in error", () => {
    render(
      <TextArea
        label="Razón de la decisión"
        helperText="Explicá el motivo en una o dos oraciones."
        error="Campo obligatorio."
      />
    );

    const textarea = screen.getByLabelText("Razón de la decisión");

    expect(textarea).toHaveAccessibleDescription(expect.stringContaining("Campo obligatorio."));
    expect(textarea).toHaveAccessibleDescription(
      expect.stringContaining("Explicá el motivo en una o dos oraciones.")
    );
    expect(screen.getByText("Explicá el motivo en una o dos oraciones.")).toBeVisible();
  });

  it("marks the visible error region as an alert for assistive tech (T3: needed by HumanDecisionForm's migrated reason field)", () => {
    render(<TextArea label="Razón de la decisión" error="La razón es obligatoria." />);

    expect(screen.getByRole("alert")).toHaveTextContent("La razón es obligatoria.");
  });
});
