import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FakeKyc } from "@/test/fake-kyc";
import { FakeWalletBalance, FakeWalletConnection } from "@/test/fake-wallet";
import { CompanyWorkspace } from "./company-workspace";

const PUBLIC_KEY = "GBXK1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ2345677Q2M";

function renderWorkspace(connection = new FakeWalletConnection()) {
  render(
    <CompanyWorkspace kyc={new FakeKyc()} connection={connection} balance={new FakeWalletBalance()} />
  );
  return connection;
}

describe("CompanyWorkspace", () => {
  it("shows the PyME dashboard skeleton with an active 'Registrar mi PyME' action", () => {
    renderWorkspace();

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
    renderWorkspace();

    screen.getByRole("button", { name: "Registrar mi PyME" });
    fireEvent.click(screen.getByRole("button", { name: "Registrar mi PyME" }));
    expect(screen.getByRole("heading", { level: 1, name: "Verificación de identidad" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Mi campaña" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Volver a la pantalla anterior" }));
    expect(screen.getByRole("heading", { level: 1, name: "Mi campaña" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Verificación de identidad" })).not.toBeInTheDocument();
  });

  it("shows no wallet card while no account is linked", () => {
    renderWorkspace();

    expect(screen.queryByRole("heading", { name: "Freighter conectada de forma no custodial" })).not.toBeInTheDocument();
  });

  it("shows the wallet card once an account is linked and reads its balance", async () => {
    const connection = new FakeWalletConnection();
    connection.seedConnection(PUBLIC_KEY);
    const balance = new FakeWalletBalance();
    balance.seedBalance("12.5000000");
    render(<CompanyWorkspace kyc={new FakeKyc()} connection={connection} balance={balance} />);

    const card = await screen.findByRole("region", { name: "Freighter conectada de forma no custodial" });
    expect(within(card).getByText("STELLAR TESTNET")).toBeInTheDocument();
    expect(within(card).getByText("Saldo disponible")).toBeInTheDocument();
    expect(within(card).getByText("12,5000000 XLM")).toBeInTheDocument();
    expect(within(card).getByText("Activo de prueba sin valor económico")).toBeInTheDocument();
    expect(within(card).getByText("GBXK…7Q2M")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /explorador de Stellar Testnet/i })).toHaveAttribute(
      "href",
      `https://stellar.expert/explorer/testnet/account/${PUBLIC_KEY}`
    );
  });
});
