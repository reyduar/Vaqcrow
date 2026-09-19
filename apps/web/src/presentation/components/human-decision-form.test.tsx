import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DecisionSubmitError } from "@/application/decision/human-decision-errors";
import { HumanDecisionForm } from "./human-decision-form";

function setup(props: Partial<React.ComponentProps<typeof HumanDecisionForm>> = {}) {
  const onSubmit = vi.fn();
  render(<HumanDecisionForm defaultActor="operador-demo" onSubmit={onSubmit} {...props} />);
  return { onSubmit };
}

const choose = (name: RegExp) => fireEvent.click(screen.getByRole("radio", { name }));
const type = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: /Registrar decisión/ }));

describe("HumanDecisionForm", () => {
  it("offers the three human outcomes and pre-selects none", () => {
    setup();

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios.every((radio) => !(radio as HTMLInputElement).checked)).toBe(true);
  });

  it("does not submit without an outcome and a reason, and says why", () => {
    const { onSubmit } = setup();

    submit();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Elegí una decisión.")).toBeInTheDocument();
    expect(screen.getByText("La razón es obligatoria.")).toBeInTheDocument();
  });

  it("asks for a limit only when approving and validates it", () => {
    const { onSubmit } = setup();

    expect(screen.queryByLabelText(/Límite aprobado/)).not.toBeInTheDocument();
    choose(/Aprobar/);
    type(/Razón/, "Evidencia revisada");
    type(/Límite aprobado/, "-5");
    submit();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/número entero positivo/)).toBeInTheDocument();
  });

  it("submits an approved decision with a numeric limit", () => {
    const { onSubmit } = setup();

    choose(/Aprobar/);
    type(/Razón/, "  Evidencia revisada  ");
    type(/Límite aprobado/, "5000000");
    submit();

    expect(onSubmit).toHaveBeenCalledWith({
      outcome: "approved",
      actor: "operador-demo",
      reason: "Evidencia revisada",
      approvedLimitArs: 5_000_000
    });
  });

  it("sends a null limit for a rejection even if a limit was typed before switching", () => {
    const { onSubmit } = setup();

    choose(/Aprobar/);
    type(/Límite aprobado/, "5000000");
    choose(/Rechazar/);
    type(/Razón/, "Documentación insuficiente");
    submit();

    expect(screen.queryByLabelText(/Límite aprobado/)).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ outcome: "rejected", approvedLimitArs: null }));
  });

  it("states that the AI cannot approve and that the decision belongs to a person", () => {
    setup();

    expect(screen.getByText(/La IA no aprueba ni define el límite/)).toBeInTheDocument();
  });

  it("renders a submit error as an alert and keeps the typed values for retry", () => {
    const error: DecisionSubmitError = { kind: "network", message: "No se pudo confirmar el resultado." };
    setup({ error });

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo confirmar el resultado.");
  });

  it("disables submit while a decision is being sent", () => {
    setup({ isSubmitting: true });

    expect(screen.getByRole("button", { name: /Registrando/ })).toBeDisabled();
  });
});
