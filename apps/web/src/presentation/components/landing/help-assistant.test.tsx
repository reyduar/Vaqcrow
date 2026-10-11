import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The quick links are `next/link`s; no router behaviour is asserted.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/"
}));

import { HelpAssistant } from "./help-assistant";

const TOGGLE = "Abrir ayuda";

describe("HelpAssistant (Feature #418, WU4)", () => {
  it("keeps the panel hidden until the toggle is used, then opens it", () => {
    render(<HelpAssistant />);

    const toggle = screen.getByRole("button", { name: TOGGLE });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("closes the panel when the toggle is used again", () => {
    render(<HelpAssistant />);

    const toggle = screen.getByRole("button", { name: TOGGLE });
    fireEvent.click(toggle);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("names the dialog for assistive technology", () => {
    render(<HelpAssistant />);
    fireEvent.click(screen.getByRole("button", { name: TOGGLE }));

    expect(screen.getByRole("dialog", { name: "Asistente de ayuda" })).toBeInTheDocument();
  });

  it("greets the visitor and points the three quick links at /help and #limites", () => {
    render(<HelpAssistant />);
    fireEvent.click(screen.getByRole("button", { name: TOGGLE }));

    const panel = within(screen.getByRole("dialog"));
    expect(
      panel.getByText("Hola. Todavía no estoy conectado, pero estas respuestas te pueden servir:")
    ).toBeInTheDocument();
    expect(panel.getByRole("link", { name: "¿Qué es el revenue share?" })).toHaveAttribute("href", "/help");
    expect(panel.getByRole("link", { name: "¿Vaqcrow guarda mis fondos?" })).toHaveAttribute("href", "/help");
    expect(panel.getByRole("link", { name: "¿Qué es real y qué es simulado?" })).toHaveAttribute("href", "#limites");
  });

  it("shows the disabled question input with its sr-only label and the help-center link", () => {
    render(<HelpAssistant />);
    fireEvent.click(screen.getByRole("button", { name: TOGGLE }));

    const panel = within(screen.getByRole("dialog"));
    const input = panel.getByLabelText("Escribí tu pregunta");
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("placeholder", "Escribir pregunta · próximamente");
    expect(panel.getByRole("link", { name: "Ir al centro de ayuda" })).toHaveAttribute("href", "/help");
  });

  it("closes the panel on Escape", () => {
    render(<HelpAssistant />);
    fireEvent.click(screen.getByRole("button", { name: TOGGLE }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: TOGGLE })).toHaveAttribute("aria-expanded", "false");
  });
});
