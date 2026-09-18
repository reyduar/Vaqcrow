import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SmeRequestForm } from "./sme-request-form";

const SIMULADO = "SIMULADO";

function setup(props: Partial<React.ComponentProps<typeof SmeRequestForm>> = {}) {
  const onSubmit = vi.fn();
  render(<SmeRequestForm simuladoLabel={SIMULADO} onSubmit={onSubmit} {...props} />);
  return { onSubmit };
}

function type(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillValid() {
  type(/Total declarado/, "1200000");
  type(/Período desde/, "2026-01");
  type(/Período hasta/, "2026-08");
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /Enviar solicitud/ }));
}

describe("SmeRequestForm", () => {
  it("renders labeled fields and a SIMULADO label", () => {
    setup();

    expect(screen.getByLabelText(/Total declarado/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Período desde/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Período hasta/)).toBeInTheDocument();
    expect(screen.getAllByText(SIMULADO).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Enviar solicitud/ })).toBeInTheDocument();
  });

  it("shows required hints and does not submit when fields are empty", async () => {
    const { onSubmit } = setup();

    submit();

    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    expect(screen.getAllByText(/Campo obligatorio/).length).toBe(3);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows a format hint for a malformed period and does not submit", async () => {
    const { onSubmit } = setup();

    type(/Total declarado/, "1200000");
    type(/Período desde/, "enero");
    type(/Período hasta/, "2026-08");
    submit();

    expect(await screen.findByText(/Usá el formato AAAA-MM/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("passes the raw string values to onSubmit without interpreting them", async () => {
    const { onSubmit } = setup();

    fillValid();
    submit();

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      declaredTotalArs: "1200000",
      periodStart: "2026-01",
      periodEnd: "2026-08"
    });
  });

  it("renders a supplied submit error as-is in an alert region", () => {
    setup({ submitError: { message: "El período final no puede ser anterior al inicial." } });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "El período final no puede ser anterior al inicial."
    );
  });

  it("renders supplied field errors next to their field", () => {
    setup({ submitError: { fieldErrors: { periodEnd: "Debe ser posterior al inicio." } } });

    expect(screen.getByText("Debe ser posterior al inicio.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Período hasta/)).toHaveAttribute("aria-invalid", "true");
  });

  it("disables the submit button while submitting", () => {
    setup({ isSubmitting: true });

    expect(screen.getByRole("button", { name: /Enviando/ })).toBeDisabled();
  });
});
