import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button, type ButtonVariant } from "./button";

const VARIANTS: readonly ButtonVariant[] = ["primary", "secondary", "ghost", "destructive"];

describe("Button", () => {
  it.each(VARIANTS)("renders the %s variant with visible text and fires onPress", (variant) => {
    const onPress = vi.fn();
    render(
      <Button variant={variant} onPress={onPress}>
        Continuar
      </Button>
    );

    const button = screen.getByRole("button", { name: "Continuar" });
    fireEvent.click(button);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("shows a visible loading label, marks aria-busy, and disables the button while loading", () => {
    const onPress = vi.fn();
    render(
      <Button isLoading loadingLabel="Enviando…" onPress={onPress}>
        Enviar solicitud
      </Button>
    );

    const button = screen.getByRole("button", { name: "Enviando…" });

    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    expect(screen.queryByText("Enviar solicitud")).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("renders a visible disabled reason linked via aria-describedby, not only a tooltip", () => {
    render(
      <Button isDisabled disabledReason="Completá el CUIT para firmar.">
        Firmar distribución
      </Button>
    );

    const button = screen.getByRole("button", { name: "Firmar distribución" });
    const reason = screen.getByText("Completá el CUIT para firmar.");

    expect(button).toBeDisabled();
    expect(button.getAttribute("aria-describedby")).toContain(reason.id);
  });

  it("never shows a disabled reason when the button is enabled", () => {
    render(<Button disabledReason="No debería verse">Enviar</Button>);

    expect(screen.queryByText("No debería verse")).not.toBeInTheDocument();
  });
});
