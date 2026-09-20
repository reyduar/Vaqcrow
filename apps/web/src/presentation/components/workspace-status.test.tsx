import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WalletError } from "@/application/ports/wallet-port";
import type { WalletPort } from "@/application/ports/wallet-port";
import { WorkspaceStatus } from "./workspace-status";

/** Deterministic wallet double — the real adapter talks to a browser extension. */
function createWallet(overrides: Partial<WalletPort> = {}): WalletPort {
  return {
    isAvailable: async () => true,
    connect: async () => ({ publicKey: "GABC123" }),
    signTransaction: async () => "signed-xdr",
    ...overrides
  };
}

describe("WorkspaceStatus", () => {
  it("renders the workspace heading", () => {
    render(<WorkspaceStatus wallet={createWallet()} />);

    expect(screen.getByRole("heading", { name: "Vaqcrow Workspace" })).toBeInTheDocument();
  });

  it("renders the not-connected status message", () => {
    render(<WorkspaceStatus wallet={createWallet()} />);

    expect(screen.getByText("Status: not connected")).toBeInTheDocument();
  });

  it("shows connected once the wallet grants access", async () => {
    render(<WorkspaceStatus wallet={createWallet()} />);

    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));

    await waitFor(() => {
      expect(screen.getByText("Status: connected")).toBeInTheDocument();
    });
  });

  it("shows connection failed when the wallet is unavailable", async () => {
    const wallet = createWallet({
      connect: async () => {
        throw new WalletError("unavailable", "Freighter is not available in this browser");
      }
    });
    render(<WorkspaceStatus wallet={wallet} />);

    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));

    await waitFor(() => {
      expect(screen.getByText("Status: connection failed")).toBeInTheDocument();
    });
  });
});
