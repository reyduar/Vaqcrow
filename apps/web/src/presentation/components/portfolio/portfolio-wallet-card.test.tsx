import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FakeWallet, FakeWalletConnection } from "@/test/fake-wallet";
import { PortfolioWalletCard } from "./portfolio-wallet-card";

/**
 * The portfolio wallet surface (Feature #426, WU4; reworked by issue #544): the
 * connected card is the existing `WalletCard`, and the disconnected state is a
 * connect-mode card whose Freighter errors reuse the PyME flow's copy.
 *
 * The Testnet-funds help is only useful with an address: the disconnected state
 * never renders a Friendbot link (without `addr` Friendbot answers 400 and funds
 * nothing), and the connected state offers a prefilled Friendbot link only while
 * the account still needs XLM.
 */

const PUBLIC_KEY = "GBX4RK7PQ2M6VZ5HJTN3WLCE8YDA9SFU4GQOB2XK7IRMNHT6PLQ7LM";

const CONNECTED = { publicKey: PUBLIC_KEY, frozen: false, balanceXlm: "1250.0000000" } as const;
const UNFUNDED = { publicKey: PUBLIC_KEY, frozen: false, balanceXlm: "0.0000000" } as const;

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

/** Every Friendbot anchor must carry the address Friendbot requires. */
function expectNoAddresslessFriendbotAnchor(): void {
  for (const anchor of Array.from(document.querySelectorAll("a"))) {
    const href = anchor.getAttribute("href") ?? "";
    if (/friendbot/i.test(href)) {
      expect(href).toContain("addr=");
    }
  }
}

describe("PortfolioWalletCard", () => {
  describe("disconnected", () => {
    it("offers «Conectar Freighter» as the primary action", () => {
      renderCard();

      expect(screen.getByRole("button", { name: "Conectar Freighter" })).toBeInTheDocument();
    });

    it("never renders a Friendbot link, because there is no address to fund", () => {
      renderCard();

      expect(screen.queryByRole("link", { name: /friendbot/i })).not.toBeInTheDocument();
      expect(document.querySelector('a[href*="friendbot"]')).toBeNull();
      expectNoAddresslessFriendbotAnchor();
    });

    it("still offers the address-free Stellar Laboratory help", () => {
      renderCard();

      expect(screen.getByRole("link", { name: /Stellar Laboratory/ })).toHaveAttribute(
        "href",
        "https://laboratory.stellar.org"
      );
    });
  });

  describe("connected and unfunded", () => {
    it("renders the connected WalletCard and warns that Testnet XLM is needed", () => {
      renderCard({ wallet: UNFUNDED });

      expect(screen.getByText("Freighter conectada de forma no custodial")).toBeInTheDocument();
      expect(screen.getByText(/todavía no tiene XLM de Testnet/i)).toBeInTheDocument();
    });

    it("offers a working Friendbot link prefilled with the wallet address", () => {
      renderCard({ wallet: UNFUNDED });

      const link = screen.getByRole("link", { name: /friendbot/i });
      expect(link).toHaveAttribute("href", `https://friendbot.stellar.org/?addr=${PUBLIC_KEY}`);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
      expectNoAddresslessFriendbotAnchor();
    });
  });

  describe("connected and funded", () => {
    it("does not warn the person about funding", () => {
      renderCard({ wallet: CONNECTED });

      expect(screen.getByText("Freighter conectada de forma no custodial")).toBeInTheDocument();
      expect(screen.queryByText(/todavía no tiene XLM de Testnet/i)).not.toBeInTheDocument();
    });

    it("offers no Friendbot link when nothing needs funding", () => {
      renderCard({ wallet: CONNECTED });

      expect(screen.queryByRole("link", { name: /friendbot/i })).not.toBeInTheDocument();
      expectNoAddresslessFriendbotAnchor();
    });

    it("keeps the honest Testnet framing (no economic value, no custody)", () => {
      renderCard({ wallet: CONNECTED });

      expect(screen.getAllByText(/sin valor económico/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/no custodia fondos ni mueve dinero/i)).toBeInTheDocument();
    });
  });

  describe("the connect sequence", () => {
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
});
