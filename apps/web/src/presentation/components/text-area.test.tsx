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
});
