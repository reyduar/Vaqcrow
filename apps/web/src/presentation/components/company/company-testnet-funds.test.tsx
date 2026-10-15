import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompanyTestnetFunds } from "./company-testnet-funds";

const PUBLIC_KEY = "GBXK1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ2345677Q2M";

/** Friendbot may never be the primary action: it is explanatory help at most. */
function expectNoFriendbotButton(): void {
  expect(screen.queryByRole("button", { name: /friendbot/i })).not.toBeInTheDocument();
  expect(screen.queryByText("Fondear con Friendbot")).not.toBeInTheDocument();
}

describe("CompanyTestnetFunds", () => {
  it("renders the guide text and the non-custodial note", () => {
    render(<CompanyTestnetFunds publicKey={null} />);

    expect(screen.getByRole("heading", { name: "Fondear tu wallet con XLM de prueba" })).toBeInTheDocument();
    expect(screen.getByText(/Vaqcrow no custodia fondos ni mueve dinero/i)).toBeInTheDocument();
    expect(screen.getByText(/sin valor económico/i)).toBeInTheDocument();
  });

  describe("disconnected", () => {
    it("offers «Conectar Freighter» as the primary action and no Friendbot button", () => {
      render(<CompanyTestnetFunds publicKey={null} onConnect={vi.fn()} />);

      expect(screen.getByRole("button", { name: "Conectar Freighter" })).toBeEnabled();
      expectNoFriendbotButton();
    });

    it("calls onConnect when the action is pressed", () => {
      const onConnect = vi.fn();
      render(<CompanyTestnetFunds publicKey={null} onConnect={onConnect} />);

      fireEvent.click(screen.getByRole("button", { name: "Conectar Freighter" }));

      expect(onConnect).toHaveBeenCalledTimes(1);
    });

    it("shows the connecting label and disables the action while connecting", () => {
      render(<CompanyTestnetFunds publicKey={null} onConnect={vi.fn()} connecting />);

      const button = screen.getByRole("button", { name: /Conectando/ });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-busy", "true");
    });

    it("surfaces a connect failure as an alert", () => {
      render(
        <CompanyTestnetFunds
          publicKey={null}
          onConnect={vi.fn()}
          error="No pudimos conectar Freighter. Probá de nuevo."
        />
      );

      expect(screen.getByRole("alert")).toHaveTextContent("No pudimos conectar Freighter. Probá de nuevo.");
    });
  });

  describe("connected and funded", () => {
    it("points at the wallet card for the balance and says it can pay, with no connect action", () => {
      render(<CompanyTestnetFunds publicKey={PUBLIC_KEY} balanceXlm="12.5000000" />);

      expect(screen.getByText(/Mirá tu saldo disponible en la tarjeta de wallet, arriba/)).toBeInTheDocument();
      // #531: the guide never repeats the number — the wallet card shows it.
      expect(screen.queryByText("12,5000000 XLM")).not.toBeInTheDocument();
      expect(screen.getByText(/ya tiene XLM de Testnet para pagar la creación de la bóveda/i)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Conectar Freighter" })).not.toBeInTheDocument();
      expectNoFriendbotButton();
    });

    it("does not offer the Friendbot link when nothing needs funding", () => {
      render(<CompanyTestnetFunds publicKey={PUBLIC_KEY} balanceXlm="12.5000000" />);

      expect(screen.queryByRole("link", { name: /friendbot/i })).not.toBeInTheDocument();
    });
  });

  describe("connected and unfunded", () => {
    it("warns that Testnet XLM is needed, without repeating the balance", () => {
      render(<CompanyTestnetFunds publicKey={PUBLIC_KEY} balanceXlm="0.0000000" />);

      expect(screen.getByText(/Mirá tu saldo disponible en la tarjeta de wallet, arriba/)).toBeInTheDocument();
      expect(screen.queryByText("0,0000000 XLM")).not.toBeInTheDocument();
      expect(screen.getByText(/todavía no tiene XLM de Testnet/i)).toBeInTheDocument();
    });

    it("offers Friendbot only as a secondary link, prefilled and never a primary action", () => {
      render(<CompanyTestnetFunds publicKey={PUBLIC_KEY} balanceXlm="0.0000000" />);

      const link = screen.getByRole("link", { name: /friendbot/i });
      expect(link).toHaveAttribute("href", `https://friendbot.stellar.org/?addr=${PUBLIC_KEY}`);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
      expectNoFriendbotButton();
    });
  });
});
