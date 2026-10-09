import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FakeWallet, FakeWalletConnection } from "@/test/fake-wallet";
import { PortfolioWalletCard } from "./portfolio-wallet-card";

/**
 * The portfolio wallet surface (Feature #426, WU4): the connected card is the
 * existing `WalletCard`, and the disconnected state is a connect-mode card whose
 * Freighter errors reuse the PyME flow's copy and whose Testnet-funds guide
 * points at Friendbot and Stellar Laboratory.
 */

const PUBLIC_KEY = "GBX4RK7PQ2M6VZ5HJTN3WLCE8YDA9SFU4GQOB2XK7IRMNHT6PLQ7LM";

const CONNECTED = { publicKey: PUBLIC_KEY, frozen: false, balanceXlm: "1250.0000000" } as const;

function connectedWallet(key = PUBLIC_KEY): FakeWallet {
  const wallet = new FakeWallet();
  wallet.seedAccount(key);
  return wallet;
}

function renderCard(props: Partial<Parameters<typeof PortfolioWalletCard>[0]> = {}) {
  return render(
    <PortfolioWalletCard
      wallet={null}
      walletPort={connectedWallet()}
      connectionPort={new FakeWalletConnection()}
      onConnected={vi.fn()}
      onDisconnect={vi.fn()}
      {...props}
    />
  );
}

describe("PortfolioWalletCard", () => {
  it("renders the connected WalletCard when a key exists", () => {
    renderCard({ wallet: CONNECTED });

    expect(screen.getByText("Freighter conectada de forma no custodial")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Conectar Freighter" })).not.toBeInTheDocument();
  });

  it("renders the connect-mode card with the Testnet-funds guide when there is no key", () => {
    renderCard();

    expect(screen.getByRole("button", { name: "Conectar Freighter" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Friendbot/ })).toHaveAttribute("href", "https://friendbot.stellar.org");
    expect(screen.getByRole("link", { name: /Stellar Laboratory/ })).toHaveAttribute(
      "href",
      "https://laboratory.stellar.org"
    );
  });

  it("connects, stores the key and notifies the container once", async () => {
    const connection = new FakeWalletConnection();
    const onConnected = vi.fn();
    renderCard({ connectionPort: connection, onConnected });

    fireEvent.click(screen.getByRole("button", { name: "Conectar Freighter" }));

    await waitFor(() => expect(onConnected).toHaveBeenCalledTimes(1));
    expect(connection.submitted).toHaveLength(1);
  });

  it("surfaces the not-installed copy when no wallet is available", async () => {
    const wallet = new FakeWallet();
    wallet.failNextConnect("unavailable");
    renderCard({ walletPort: wallet });

    fireEvent.click(screen.getByRole("button", { name: "Conectar Freighter" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No encontramos Freighter");
  });

  it("surfaces the wrong-network copy", async () => {
    const wallet = new FakeWallet();
    wallet.failNextConnect("network_mismatch");
    renderCard({ walletPort: wallet });

    fireEvent.click(screen.getByRole("button", { name: "Conectar Freighter" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Cambiá a Stellar Testnet");
  });

  it("surfaces the rejected copy when the person cancels in Freighter", async () => {
    const wallet = new FakeWallet();
    wallet.failNextConnect("rejected");
    renderCard({ walletPort: wallet });

    fireEvent.click(screen.getByRole("button", { name: "Conectar Freighter" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Cancelaste la conexión en Freighter");
  });

  it("surfaces a sanitized persistence failure when the key cannot be stored", async () => {
    const connection = new FakeWalletConnection();
    connection.failNextSubmit("unavailable");
    const onConnected = vi.fn();
    renderCard({ connectionPort: connection, onConnected });

    fireEvent.click(screen.getByRole("button", { name: "Conectar Freighter" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos guardar tu wallet");
    expect(onConnected).not.toHaveBeenCalled();
  });
});
