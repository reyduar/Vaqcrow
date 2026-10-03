import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FakeKyc } from "@/test/fake-kyc";
import { CompanyWorkspace } from "./company-workspace";

describe("CompanyWorkspace", () => {
  it("shows the PyME dashboard skeleton with an active 'Registrar mi PyME' action", () => {
    render(<CompanyWorkspace kyc={new FakeKyc()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Mi campaña" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Estado de la bóveda de tu campaña y las distribuciones que tenés que firmar. Todo corre en Stellar Testnet con datos sintéticos."
      )
    ).toBeInTheDocument();

    const register = screen.getByRole("button", { name: "Registrar mi PyME" });
    expect(register).toBeEnabled();
    expect(register).not.toHaveAttribute("aria-disabled");
    expect(screen.queryByRole("link", { name: "Registrar mi PyME" })).not.toBeInTheDocument();
  });

  it("opens the wizard in place and returns to the dashboard with Volver", () => {
    render(<CompanyWorkspace kyc={new FakeKyc()} />);

    fireEvent.click(screen.getByRole("button", { name: "Registrar mi PyME" }));
    expect(screen.getByRole("heading", { level: 1, name: "Verificación de identidad" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Mi campaña" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Volver a la pantalla anterior" }));
    expect(screen.getByRole("heading", { level: 1, name: "Mi campaña" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Verificación de identidad" })).not.toBeInTheDocument();
  });
});
