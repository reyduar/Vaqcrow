import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEMO_VALUES } from "@/application/pyme-onboarding/registration-step";
import { RegistrationStep } from "./registration-step";

function renderStep(props: Partial<React.ComponentProps<typeof RegistrationStep>> = {}) {
  const onSubmit = vi.fn();
  render(<RegistrationStep onSubmit={onSubmit} {...props} />);
  return { onSubmit };
}

function fillDemo() {
  fireEvent.click(screen.getByRole("button", { name: "Completar con datos de ejemplo" }));
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Enviar a evaluación AI" }));
}

describe("RegistrationStep copy and layout", () => {
  it("renders the template's step-2 heading, subtitle and the two callouts", () => {
    renderStep();

    expect(screen.getByRole("heading", { level: 1, name: "Registrá tu PyME" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Contanos qué hace tu empresa y cargá la evidencia de ventas. Con esto la IA arma una evaluación consultiva y una persona decide si la campaña se publica."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("La IA recomienda; una persona decide.")).toBeInTheDocument();
    expect(screen.getByText("La IA recomienda; una persona decide.").parentElement).toHaveTextContent(
      "Enviar no aprueba la campaña ni abre la bóveda."
    );
    expect(
      screen.getByText("Demo: usá datos sintéticos. No cargues información real de tu empresa.")
    ).toBeInTheDocument();
  });

  it("renders the form card heading, the fill-demo action and every labelled control", () => {
    renderStep();

    expect(screen.getByRole("heading", { level: 2, name: "Datos de la empresa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Completar con datos de ejemplo" })).toBeInTheDocument();

    const form = screen.getByRole("form", { name: "Datos de la empresa" });
    expect(form).toHaveAttribute("novalidate");

    expect(screen.getByLabelText("Razón social")).toHaveAttribute("placeholder", "Ej. Panadería Horizonte SRL");
    expect(screen.getByLabelText("CUIT")).toHaveAttribute("placeholder", "30-00000000-0");
    expect(screen.getByLabelText("CUIT")).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByText("11 dígitos")).toBeInTheDocument();

    const sector = screen.getByLabelText("Rubro");
    expect(sector.tagName).toBe("SELECT");
    expect(sector).toHaveValue("");
    expect(screen.getByRole("option", { name: "Elegí un rubro" })).toHaveValue("");

    expect(screen.getByLabelText("Ciudad")).toHaveAttribute("placeholder", "Ej. Córdoba");
    expect(screen.getByLabelText("Breve descripción del negocio")).toHaveAttribute(
      "placeholder",
      "Qué vendés, a quién y para qué necesitás el financiamiento"
    );
    expect(screen.getByLabelText("Meta de financiamiento (ARS)")).toHaveAttribute("placeholder", "15.000.000");
    expect(screen.getByLabelText("Revenue share propuesto (%)")).toHaveAttribute("placeholder", "4,5");
    expect(screen.getByText("Entre 1 % y 10 % de las ventas mensuales")).toBeInTheDocument();

    expect(screen.getByText("Ventas mensuales 2026 (ARS)")).toBeInTheDocument();
    expect(screen.getByText("SIMULADO")).toBeInTheDocument();
    expect(
      screen.getByText("Dejá vacío un mes sin declaración: se marca como faltante, nunca como cero.")
    ).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Enviar a evaluación AI" })).toBeInTheDocument();
    expect(
      screen.getByText("Enviar no publica la campaña. Primero pasa por la evaluación de IA y la decisión de una persona.")
    ).toBeInTheDocument();
  });

  it("does not render the T4 attach/upload control", () => {
    renderStep();

    expect(screen.queryByText("Declaraciones de ventas")).not.toBeInTheDocument();
    expect(screen.queryByText(/Adjuntar declaraciones/)).not.toBeInTheDocument();
    expect(screen.queryByText(/declaraciones-2026-sinteticas/)).not.toBeInTheDocument();
  });

  it("renders the eight sales months with the template's aria labels", () => {
    renderStep();

    expect(screen.getByLabelText("Ventas de enero en ARS")).toHaveAttribute("placeholder", "Sin dato");
    expect(screen.getByLabelText("Ventas de agosto en ARS")).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText("Sin dato")).toHaveLength(8);
  });
});

describe("RegistrationStep validation", () => {
  it("shows no errors nor summary before the first submit attempt", () => {
    renderStep();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Ingresá la razón social.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Razón social")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("Razón social")).not.toHaveAttribute("aria-describedby");
  });

  it("on an empty submit shows the summary, every template message and moves focus to the first field", () => {
    const { onSubmit } = renderStep();

    submit();

    expect(screen.getByRole("alert")).toHaveTextContent("Revisá 8 campos.");
    expect(screen.getByRole("alert")).toHaveTextContent("Están marcados abajo.");
    expect(screen.getByText("Ingresá la razón social.")).toBeInTheDocument();
    expect(screen.getByText("El CUIT debe tener 11 dígitos.")).toBeInTheDocument();
    expect(screen.getByText("Elegí un rubro.")).toBeInTheDocument();
    expect(screen.getByText("Ingresá la ciudad.")).toBeInTheDocument();
    expect(screen.getByText("Contanos un poco más: al menos 20 caracteres.")).toBeInTheDocument();
    expect(screen.getByText("Cargá al menos 6 de los 8 meses.")).toBeInTheDocument();
    expect(screen.getByText("La meta mínima es ARS 1.000.000.")).toBeInTheDocument();
    expect(screen.getByText("Debe estar entre 1 % y 10 %.")).toBeInTheDocument();

    expect(screen.getByLabelText("Razón social")).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("links a field error through aria-invalid and aria-describedby only while invalid", () => {
    renderStep();

    submit();

    const name = screen.getByLabelText("Razón social");
    expect(name).toHaveAttribute("aria-invalid", "true");
    const describedBy = name.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent("Ingresá la razón social.");
  });

  it("marks the empty months as faltantes only after a submit attempt", () => {
    renderStep();

    expect(screen.queryByText("Faltante")).not.toBeInTheDocument();
    submit();
    expect(screen.getAllByText("Faltante")).toHaveLength(8);
  });

  it("recomputes the errors live once the person edits an invalid field", () => {
    renderStep();

    submit();
    expect(screen.getByText("Ingresá la razón social.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Razón social"), { target: { value: "Panadería Horizonte SRL" } });
    expect(screen.queryByText("Ingresá la razón social.")).not.toBeInTheDocument();
  });

  it("counts only the distinct invalid fields in the summary", () => {
    renderStep();

    fireEvent.change(screen.getByLabelText("Razón social"), { target: { value: "Panadería Horizonte SRL" } });
    submit();

    expect(screen.getByRole("alert")).toHaveTextContent("Revisá 7 campos.");
  });
});

describe("RegistrationStep demo values", () => {
  it("fills every field with the template's demo values", () => {
    renderStep();

    fillDemo();

    expect(screen.getByLabelText("Razón social")).toHaveValue("Panadería Horizonte SRL");
    expect(screen.getByLabelText("CUIT")).toHaveValue("30-71234567-8");
    expect(screen.getByLabelText("Rubro")).toHaveValue("Alimentos");
    expect(screen.getByLabelText("Ciudad")).toHaveValue("Córdoba");
    expect(screen.getByLabelText("Breve descripción del negocio")).toHaveValue(DEMO_VALUES.desc);
    expect(screen.getByLabelText("Meta de financiamiento (ARS)")).toHaveValue("15.000.000");
    expect(screen.getByLabelText("Revenue share propuesto (%)")).toHaveValue("4,5");
    expect(screen.getByLabelText("Ventas de junio en ARS")).toHaveValue("6.240.000");
    expect(screen.getByLabelText("Ventas de abril en ARS")).toHaveValue("");
  });

  it("shows the anomaly indicator on the demo's June, with accessible text", () => {
    renderStep();

    fillDemo();

    expect(screen.getByText("Anomalía")).toBeInTheDocument();
    expect(screen.getByLabelText("Ventas de junio en ARS")).toBeInTheDocument();
  });

  it("submits the demo values without an error summary", async () => {
    const { onSubmit } = renderStep();

    fillDemo();
    submit();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toEqual(DEMO_VALUES);
  });

  it("shows the busy state while a promise-returning submit settles, then re-enables", async () => {
    let release!: () => void;
    const onSubmit = vi.fn(
      (): Promise<void> =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
    renderStep({ onSubmit });

    fillDemo();
    submit();

    expect(screen.getByRole("button", { name: "Enviando…" })).toBeDisabled();

    await act(async () => {
      release();
    });

    expect(screen.getByRole("button", { name: "Enviar a evaluación AI" })).toBeEnabled();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
