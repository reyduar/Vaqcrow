// Probe regression tests — issue #544 (AC1/AC2/AC3 + reuse + honesty).
// Authored by the independent verifier; committed by the orchestrator.
// Target: apps/web/src/presentation/components/portfolio/portfolio-wallet-funding.regression.test.tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PortfolioPort, PortfolioSummary } from "@/application/ports/portfolio-port";
import type { WalletBalancePort } from "@/application/ports/wallet-balance-port";
import { FakeWallet, FakeWalletConnection } from "@/test/fake-wallet";
import { PortfolioWalletCard } from "@/presentation/components/portfolio/portfolio-wallet-card";
import { Portfolio } from "@/presentation/components/portfolio/portfolio";

const KEY_A = "GBX4RK7PQ2M6VZ5HJTN3WLCE8YDA9SFU4GQOB2XK7IRMNHT6PLQ7LM";
const KEY_B = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
beforeEach(() => push.mockClear());

const SWR_ISOLATED = { provider: () => new Map(), dedupingInterval: 0 } as const;

function card(props: Partial<Parameters<typeof PortfolioWalletCard>[0]> = {}) {
  const w = new FakeWallet();
  w.seedAccount(KEY_A);
  return render(
    <PortfolioWalletCard
      wallet={null}
      walletPort={w}
      connectionPort={new FakeWalletConnection()}
      onConnected={vi.fn()}
      onDisconnect={vi.fn()}
      {...props}
    />
  );
}
const anchors = () => Array.from(document.querySelectorAll("a"));
const friendbotAnchors = () => anchors().filter((a) => /friendbot/i.test(a.getAttribute("href") ?? ""));

// AC1
describe("AC1 — no Friendbot link without an address", () => {
  it("disconnected: zero friendbot anchors, no addressless friendbot href", () => {
    card();
    expect(friendbotAnchors()).toHaveLength(0);
    for (const a of anchors()) {
      const href = a.getAttribute("href") ?? "";
      if (/friendbot/i.test(href)) expect(href).toContain("addr=");
    }
    expect(document.body.innerHTML).not.toContain('href="https://friendbot.stellar.org"');
  });
  it("all three states: every friendbot href carries addr=", () => {
    for (const wallet of [
      null,
      { publicKey: KEY_A, frozen: false, balanceXlm: "0" },
      { publicKey: KEY_A, frozen: false, balanceXlm: "1250.0000000" }
    ] as const) {
      const { unmount } = card({ wallet });
      for (const a of friendbotAnchors()) expect(a.getAttribute("href")).toContain("addr=");
      unmount();
    }
  });
});

// AC2
describe("AC2 — connected unfunded: warning + prefilled link", () => {
  it("warns and prefills Friendbot with the real publicKey", () => {
    card({ wallet: { publicKey: KEY_A, frozen: false, balanceXlm: "0.0000000" } });
    expect(screen.getByText(/todavía no tiene XLM de Testnet/i)).toBeInTheDocument();
    const links = friendbotAnchors();
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", `https://friendbot.stellar.org/?addr=${KEY_A}`);
    expect(links[0]).toHaveAttribute("target", "_blank");
    expect(links[0]).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });
  it("uses the wallet's own key, not a placeholder", () => {
    card({ wallet: { publicKey: KEY_B, frozen: false, balanceXlm: "0" } });
    expect(friendbotAnchors()[0]).toHaveAttribute("href", `https://friendbot.stellar.org/?addr=${KEY_B}`);
  });
  it("unknown balance with a key is unfunded", () => {
    card({ wallet: { publicKey: KEY_A, frozen: false, balanceXlm: null } });
    expect(friendbotAnchors()).toHaveLength(1);
  });
  it("is a secondary link, never a primary button", () => {
    card({ wallet: { publicKey: KEY_A, frozen: false, balanceXlm: "0" } });
    expect(screen.queryByRole("button", { name: /friendbot/i })).toBeNull();
    expect(screen.getByRole("link", { name: /friendbot/i })).toBeInTheDocument();
  });
  it("boundary: 0.9999999 unfunded, 1 funded", () => {
    const { unmount } = card({ wallet: { publicKey: KEY_A, frozen: false, balanceXlm: "0.9999999" } });
    expect(friendbotAnchors()).toHaveLength(1);
    unmount();
    card({ wallet: { publicKey: KEY_A, frozen: false, balanceXlm: "1" } });
    expect(friendbotAnchors()).toHaveLength(0);
  });
});

// AC3
describe("AC3 — connected funded is not warned", () => {
  it("no warning, no friendbot link, funded note shown", () => {
    card({ wallet: { publicKey: KEY_A, frozen: false, balanceXlm: "1250.0000000" } });
    expect(screen.queryByText(/todavía no tiene XLM de Testnet/i)).toBeNull();
    expect(friendbotAnchors()).toHaveLength(0);
    expect(screen.getByText(/ya tiene XLM de Testnet/i)).toBeInTheDocument();
  });
});

// honesty + regression + reuse
describe("honesty, regressions, reuse", () => {
  it("non-custody / no-value copy present in every state", () => {
    for (const balanceXlm of [null, "0", "1250.0000000"]) {
      const { unmount } = card(
        balanceXlm === null ? {} : { wallet: { publicKey: KEY_A, frozen: false, balanceXlm } }
      );
      expect(screen.getAllByText(/sin valor económico/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/no custodia/i).length).toBeGreaterThan(0);
      unmount();
    }
  });
  it("connected state still renders the existing WalletCard", () => {
    card({ wallet: { publicKey: KEY_A, frozen: false, balanceXlm: "10" } });
    expect(screen.getByText("Freighter conectada de forma no custodial")).toBeInTheDocument();
  });
  it("connect sequence still stores the key once", async () => {
    const connection = new FakeWalletConnection();
    const onConnected = vi.fn();
    card({ connectionPort: connection, onConnected });
    fireEvent.click(screen.getByRole("button", { name: "Conectar Freighter" }));
    await waitFor(() => expect(onConnected).toHaveBeenCalledTimes(1));
    expect(connection.submitted).toHaveLength(1);
  });
  it("container wiring: an unfunded read reaches the card's prefilled link", async () => {
    const summary: PortfolioSummary = {
      contributions: [],
      distributions: [],
      totals: { totalContributedXlm: "0.0000000", totalDistributionsXlm: "0.0000000", campaignCount: 0 }
    };
    const port: PortfolioPort = { get: vi.fn().mockResolvedValue({ ok: true, summary }) };
    const connection = {
      requestChallenge: vi.fn(),
      submitConnection: vi.fn(),
      getConnection: vi.fn().mockResolvedValue({ ok: true, publicKey: KEY_A, frozen: false })
    };
    const balance: WalletBalancePort = { getBalance: vi.fn().mockResolvedValue({ ok: true, balanceXlm: "0.0000000" }) };
    const ui: ReactNode = <Portfolio port={port} connection={connection} balance={balance} />;
    render(<SWRConfig value={SWR_ISOLATED}>{ui}</SWRConfig>);
    const link = await screen.findByRole("link", { name: /friendbot/i });
    expect(link).toHaveAttribute("href", `https://friendbot.stellar.org/?addr=${KEY_A}`);
  });
});
