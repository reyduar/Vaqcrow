import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WalletCard } from "./wallet-card";

const PUBLIC_KEY = "GBXK1234567890ABCD7Q2M";
const EXPLORER_URL = `https://stellar.expert/explorer/testnet/account/${PUBLIC_KEY}`;

function renderCard(props: Partial<React.ComponentProps<typeof WalletCard>> = {}) {
  const onDisconnect = vi.fn();
  render(
    <WalletCard
      publicKey={PUBLIC_KEY}
      frozen={false}
      balanceXlm="0.0000000"
      explorerUrl={EXPLORER_URL}
      onDisconnect={onDisconnect}
      {...props}
    />
  );
  return { onDisconnect };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WalletCard", () => {
  it("renders the template's verbatim copy, the shortened key and the balance", () => {
    renderCard();

    expect(screen.getByRole("heading", { name: "Freighter conectada de forma no custodial" })).toBeInTheDocument();
    expect(screen.getByText("STELLAR TESTNET")).toBeInTheDocument();
    expect(screen.getByText("Saldo disponible")).toBeInTheDocument();
    expect(screen.getByText("0.0000000 XLM")).toBeInTheDocument();
    expect(screen.getByText("Activo de prueba sin valor económico")).toBeInTheDocument();
    expect(screen.getByText("GBXK…7Q2M")).toBeInTheDocument();
    // The full key stays available to assistive tech.
    expect(screen.getByText(PUBLIC_KEY)).toBeInTheDocument();
  });

  it("links to the Stellar Testnet explorer in a new tab", () => {
    renderCard();

    const link = screen.getByRole("link", {
      name: "Ver cuenta en el explorador de Stellar Testnet (abre en una pestaña nueva)"
    });
    expect(link).toHaveAttribute("href", EXPLORER_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer noopener");
  });

  it("copies the full account and shows Copiada", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Copiar cuenta completa" }));

    expect(writeText).toHaveBeenCalledWith(PUBLIC_KEY);
    expect(await screen.findByText("Copiada")).toBeInTheDocument();
  });

  it("reports a sanitized error when the clipboard is unavailable", () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Copiar cuenta completa" }));

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos copiar la cuenta. Copiala manualmente.");
  });

  it("disconnects from the Desconectar action", () => {
    const { onDisconnect } = renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Desconectar" }));

    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it("shows the frozen state and refuses to replace the key", () => {
    const { onDisconnect } = renderCard({ frozen: true });

    expect(screen.getByText("CONGELADA")).toBeInTheDocument();
    const disconnect = screen.getByRole("button", { name: "Desconectar" });
    expect(disconnect).toBeDisabled();

    fireEvent.click(disconnect);
    expect(onDisconnect).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "La bóveda ya se abrió: esta cuenta es el destino inmutable de los fondos y no se puede cambiar."
      )
    ).toBeInTheDocument();
  });
});
